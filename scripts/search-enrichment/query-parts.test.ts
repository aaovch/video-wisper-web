import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import {searchScoped,resetSearchIndex,whenSearchComplete} from '$lib/search-core';
import {searchableReportSlugs} from '$lib/search-visibility';
import {collections} from '$lib/data/collections';
import type {SearchScope} from '$lib/search-types';
import {splitSearchQuestion,mergeQuestionParts} from './query-parts.mjs';
it('does not split quoted or numeric constraints and bounds additional searches',()=>{
 expect(splitSearchQuestion('Как выполнить «длинное остриё» и затем закончить атаку?')).toEqual([]);
 expect(splitSearchQuestion('Как подготовить батман 4 и затем закончить атаку?')).toEqual([]);
 expect(splitSearchQuestion('Укол и защита')).toEqual([]);
 const parts=splitSearchQuestion('Как удерживать равновесие в стойке и быстро менять ведущую ногу?');
 expect(parts).toHaveLength(2);
 expect(splitSearchQuestion('Партнёр не заканчивает атаку. Почему упражнение даёт неверный результат?')).toHaveLength(2);
 expect(parts.every((p:string)=>'Как удерживать равновесие в стойке и быстро менять ведущую ногу?'.includes(p))).toBe(true);
});
it('merges only retrieved candidates without duplication and preserves the baseline without parts',()=>{
 const baseline=['report:1','report:2','other:1'];
 for(const mode of ['interleave','rank-sum']){
  expect(mergeQuestionParts(baseline,[],mode)).toEqual(baseline);
  const merged=mergeQuestionParts(baseline,[['report:1','third:1'],['third:1','fourth:2']],mode);
  expect(new Set(merged).size).toBe(merged.length);
  expect(new Set(merged)).toEqual(new Set([...baseline,'third:1','fourth:2']));
 }
 expect(mergeQuestionParts(baseline,[['third:1']], 'interleave').slice(0,2)).toEqual(baseline.slice(0,2));
});
it.skipIf(!process.env.QUERY_PARTS_EVAL)('compares query-part retrieval on disclosed multi-source and balanced ordinary questions',async()=>{
 const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
 const expanded=read('scripts/search-enrichment/pilot-expanded.json').cases;
 const manual=process.env.QUERY_PARTS_MANUAL==='1'?read('scripts/search-enrichment/query-parts-manual.json'):null;
 const cases=[...read('scripts/search-enrichment/pilot-registry.json').cases.filter((q:any)=>q.kind==='multi'),...expanded.filter((q:any)=>q.kind==='multi'||(!manual&&q.variant==='original'))];
 const files=new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(n=>[n,readFileSync(`static/search/${n}`,'utf8')]));
 const visible=searchableReportSlugs([],'all');
 const rows:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(files.get(String(url).split('/').pop()!))));
 try{
  resetSearchIndex();await whenSearchComplete();
  for(const q of cases){
   const slug=q.judgments[0].reportSlug,scopes:SearchScope[]=q.kind==='multi'?[{kind:'archive',label:'archive',reportSlugs:visible}]:[
    {kind:'report',label:slug,reportSlug:slug},
    ...collections.filter(c=>!c.password&&c.items.includes(slug)).map(c=>({kind:'collection' as const,label:c.slug,reportSlugs:c.items.filter(s=>visible.includes(s))})),
    {kind:'archive',label:'archive',reportSlugs:visible}];
   const expected=q.judgments.filter((j:any)=>j.grade===3).map((j:any)=>`${j.reportSlug}:${j.chapterIndex}`);
   for(const scope of scopes){
    const allowed=scope.kind==='report'?[scope.reportSlug]:scope.reportSlugs;
    const search=async(query:string)=>{const result=await searchScoped(query,[scope],scope.kind==='archive'?30:120);expect(result.hits.every(h=>allowed.includes(h.reportSlug))).toBe(true);return {kind:result.matchKind,keys:[...new Set(result.hits.map(h=>h.chapterIndex!=null?`${h.reportSlug}:${h.chapterIndex}`:`${h.reportSlug}:${h.kind}:${h.title}`))]};};
    const start=performance.now(),base=await search(q.query),baselineMs=performance.now()-start;
    const parts=base.kind==='semantic'?(manual?.[q.id]??splitSearchQuestion(q.query)):[];
    const partStart=performance.now(),rankings=[];
    for(const p of parts)rankings.push((await search(p)).keys);
    const additionalMs=performance.now()-partStart;
    const variants=['baseline','interleave','rank-sum'].map(mode=>{
     const keys=mode==='baseline'?base.keys:mergeQuestionParts(base.keys,rankings,mode);
     return {mode,hit5:expected.some(k=>keys.slice(0,5).includes(k)),coverage5:expected.filter(k=>keys.slice(0,5).includes(k)).length/expected.length,
      coverageAll:expected.filter(k=>keys.includes(k)).length/expected.length,ranking:keys.slice(0,10)};
    });
    rows.push({id:q.id,query:q.query,kind:q.kind,scope:scope.kind,label:scope.label,parts,baselineMs,additionalMs,variants});
   }
  }
  const summary=['baseline','interleave','rank-sum'].map(mode=>{
   const singles=rows.filter(r=>r.kind==='single'),multi=rows.filter(r=>r.kind==='multi');
   return {mode,single:singles.length,hit5:singles.filter(r=>r.variants.find((v:any)=>v.mode===mode).hit5).length,
    singleLosses:singles.filter(r=>r.variants[0].hit5&&!r.variants.find((v:any)=>v.mode===mode).hit5).map(r=>({id:r.id,scope:r.scope,label:r.label})),
    multi:multi.length,coverage5:multi.reduce((n,r)=>n+r.variants.find((v:any)=>v.mode===mode).coverage5,0)/multi.length,
    coverageAll:multi.reduce((n,r)=>n+r.variants.find((v:any)=>v.mode===mode).coverageAll,0)/multi.length,
    multiLosses:multi.filter(r=>r.variants.find((v:any)=>v.mode===mode).coverage5<r.variants[0].coverage5).map(r=>r.id)};
  });
  writeFileSync(manual?'docs/search-quality/query-parts-manual.json':'docs/search-quality/query-parts.json',JSON.stringify({manualParts:manual,protocol:'Disclosed diagnostic corpus: 12 multi-source questions, plus 24 ordinary topics for automatic splitting. Manual parts (when present) were written after the automatic result, from query wording, without changing relevance judgments. Not a fresh holdout; production unchanged.',indexHash:createHash('sha256').update([...files.values()].join('')).digest('hex'),implementationHash:createHash('sha256').update(readFileSync('scripts/search-enrichment/query-parts.mjs')).digest('hex'),summary,rows},null,2)+'\n');
  console.log(summary);
 }finally{resetSearchIndex();vi.unstubAllGlobals();}
},600000);

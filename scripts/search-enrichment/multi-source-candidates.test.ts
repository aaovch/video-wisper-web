import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import {searchScoped,resetSearchIndex,whenSearchComplete} from '$lib/search-core';
import {searchableReportSlugs} from '$lib/search-visibility';
it.skipIf(!process.env.MULTI_SEARCH_DIAGNOSTIC)('locates multi-source evidence beyond the semantic result cap',async()=>{
 const cases=['pilot-registry','pilot-expanded'].flatMap(n=>JSON.parse(readFileSync(`scripts/search-enrichment/${n}.json`,'utf8')).cases).filter(q=>q.kind==='multi');
 const files=new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(n=>[n,readFileSync(`static/search/${n}`,'utf8')]));
 const visible=searchableReportSlugs([],'all');
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(files.get(String(url).split('/').pop()!))));
 const rows:any[]=[];
 try{
  resetSearchIndex();await whenSearchComplete();
  for(const cap of ['16','120']){
   vi.stubEnv('VITE_SEARCH_CANDIDATE_LIMIT',cap);
   for(const q of cases){
    const expected=q.judgments.filter((j:any)=>j.grade===3).map((j:any)=>`${j.reportSlug}:${j.chapterIndex}`);
    const started=performance.now();
    const result=await searchScoped(q.query,[{kind:'archive',label:'archive',reportSlugs:visible}],120);
    const ms=performance.now()-started;
    expect(result.hits.every(h=>visible.includes(h.reportSlug))).toBe(true);
    const keys=[...new Set(result.hits.map(h=>h.chapterIndex!=null?`${h.reportSlug}:${h.chapterIndex}`:`${h.reportSlug}:${h.kind}:${h.title}`))];
    rows.push({id:q.id,query:q.query,cap:Number(cap),ms,returned:keys.length,positions:expected.map(key=>({key,rank:keys.indexOf(key)+1})),
     coverage5:expected.filter(k=>keys.slice(0,5).includes(k)).length/expected.length,
     coverageAll:expected.filter(k=>keys.includes(k)).length/expected.length});
   }
  }
  const summary=['16','120'].map(cap=>{const rs=rows.filter(r=>r.cap===Number(cap));return {cap:Number(cap),coverage5:rs.reduce((s,r)=>s+r.coverage5,0)/rs.length,coverageAll:rs.reduce((s,r)=>s+r.coverageAll,0)/rs.length};});
  writeFileSync('docs/search-quality/multi-source-candidates.json',JSON.stringify({protocol:'Disclosed questions; diagnostic cap comparison, not a new holdout. Production cap unchanged.',indexHash:createHash('sha256').update([...files.values()].join('')).digest('hex'),summary,rows},null,2)+'\n');
  console.log(summary);
 }finally{resetSearchIndex();vi.unstubAllGlobals();vi.unstubAllEnvs();}
},120000);

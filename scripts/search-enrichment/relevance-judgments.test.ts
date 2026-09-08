import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash as chapterHash} from './core.mjs';
import {it,expect} from 'vitest';
import {evaluateReviewedCase,matchesReviewedSource} from './relevance-review.mjs';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const review=read('scripts/search-enrichment/relevance-reviewed-v1.json');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
it('freezes a separate review with traceable quotes without rewriting the original judgments',()=>{
 const raw=readFileSync('scripts/search-enrichment/relevance-reviewed-v1.json','utf8');
 expect(hash(raw)).toBe(readFileSync('scripts/search-enrichment/relevance-reviewed-v1.sha256','utf8').trim());
 const originalRaw=readFileSync('scripts/search-enrichment/pilot-expanded.json','utf8'),original=JSON.parse(originalRaw);
 expect(hash(originalRaw)).toBe(review.protocol.originalRegistrySha256);
 const strings=(o:any):string[]=>typeof o==='string'?[o]:o&&typeof o==='object'?Object.values(o).flatMap(strings):[];
 for(const q of review.cases){
  expect(q.originalJudgments).toEqual(original.cases.find((c:any)=>c.id===q.id).judgments);
  expect(q.query).toBe(original.cases.find((c:any)=>c.id===q.id).query);
  for(const j of q.judgments){
   const source=j.path.reduce((v:any,k:any)=>v[k],read(`src/lib/data/reports/${j.reportSlug}.json`));
   expect(hash(JSON.stringify(source))).toBe(j.sourceHash);
   for(const quote of j.evidence)expect(strings(source).some(s=>s.includes(quote))).toBe(true);
   expect(j.supports.every((s:string)=>q.facets.some((f:any)=>f.id===s))).toBe(true);
  }
 }
});
it('requires the concrete exercise timestamp and does not credit another item with the same title',()=>{
 const q=review.cases.find((c:any)=>c.id==='expanded-5-3-original');
 const exercise=q.judgments.find((j:any)=>j.selector.start===4822.24);
 const wrong={reportSlug:exercise.reportSlug,kind:'material',zone:'additional',title:exercise.selector.title,start:528.89};
 expect(matchesReviewedSource(wrong,exercise)).toBe(false);
 expect(evaluateReviewedCase(q,[wrong]).reviewedFacetCoverage5).toBe(0);
 expect(evaluateReviewedCase(q,[{...wrong,start:4822.24}]).complete).toBe(true);
 expect(evaluateReviewedCase(q,[{...wrong,start:999}]).unjudged).toBe(1);
});
it('allows one source to cover several requested aspects without counting repeated evidence twice',()=>{
 const q=review.cases.find((c:any)=>c.id==='expanded-multi-3');
 const note=q.judgments.find((j:any)=>j.path[0]==='seminar_notes');
 const h={reportSlug:note.reportSlug,kind:'material',zone:'additional',title:note.selector.title};
 expect(evaluateReviewedCase(q,[h,h])).toMatchObject({complete:true,reviewedFacetCoverage5:1});
 const chapter={reportSlug:note.reportSlug,kind:'chapter',chapterIndex:5};
 expect(evaluateReviewedCase(q,[chapter,chapter])).toMatchObject({complete:false,reviewedFacetCoverage5:0.5});
});
it('does not demand two different techniques when the question asks for one continuation',()=>{
 const q=review.cases.find((c:any)=>c.id==='expanded-multi-2');
 const h={reportSlug:'soedinenie-dlinnyi-mech-lager-noname-1',chapterIndex:15,kind:'chapter'};
 expect(evaluateReviewedCase(q,[h])).toMatchObject({originalChapterCoverage5:0.5,reviewedFacetCoverage5:1});
 expect(evaluateReviewedCase(q,[{reportSlug:'longsword-a',chapterIndex:14,kind:'chapter'}]).complete).toBe(false);
});

it('keeps v1 intact while validating all twelve multi-source cases and alternatives in v2',()=>{
 const raw=readFileSync('scripts/search-enrichment/relevance-reviewed-v2.json','utf8'),v2=JSON.parse(raw);
 expect(hash(raw)).toBe(readFileSync('scripts/search-enrichment/relevance-reviewed-v2.sha256','utf8').trim());
 expect(v2.cases.slice(0,review.cases.length)).toEqual(review.cases);
 expect(v2.cases).toHaveLength(13);
 const originalRaw=readFileSync('scripts/search-enrichment/pilot-registry.json','utf8'),original=JSON.parse(originalRaw);
 expect(hash(originalRaw)).toBe(v2.protocol.baseRegistrySha256);
 expect(hash(readFileSync('scripts/search-enrichment/relevance-reviewed-v1.json','utf8'))).toBe(v2.protocol.previousReviewSha256);
 const strings=(o:any):string[]=>typeof o==='string'?[o]:o&&typeof o==='object'?Object.values(o).flatMap(strings):[];
 for(const q of v2.cases){
  if(q.id.startsWith('p-multi-'))expect(q.originalJudgments).toEqual(original.cases.find((c:any)=>c.id===q.id).judgments);
  for(const j of q.judgments){
   const source=j.path.reduce((v:any,k:any)=>v[k],read(`src/lib/data/reports/${j.reportSlug}.json`));
   expect(hash(JSON.stringify(source))).toBe(j.sourceHash);
   expect(j.evidence.every((q:string)=>strings(source).some(s=>s.includes(q)))).toBe(true);
   expect(j.supports.every((id:string)=>q.facets.some((f:any)=>f.id===id))).toBe(true);
  }
 }
});

it('preserves the condition experiment questions and their actual source chapters',()=>{
 const raw=readFileSync('scripts/search-enrichment/conditions-registry.json','utf8'),r=JSON.parse(raw);
 expect(hash(raw)).toBe(readFileSync('scripts/search-enrichment/conditions-registry.sha256','utf8').trim());
 expect(r.cases).toHaveLength(9);
 expect(r.cases.filter((q:any)=>q.coverage==='control')).toHaveLength(3);
 for(const q of r.cases)for(const j of q.judgments){
  const source=read(`src/lib/data/reports/${j.reportSlug}.json`);
  expect(chapterHash(sourceFor(source,j.chapterIndex))).toBe(j.sourceHash);
  expect(source.chapters[j.chapterIndex].summary).toBe(j.evidence);
 }
});

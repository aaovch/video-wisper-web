import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {collections} from '$lib/data/collections';
import {searchScoped,resetSearchIndex,whenSearchComplete} from '$lib/search-core';
import {searchableReportSlugs} from '$lib/search-visibility';
import {searchHitKey} from '$lib/search-hit-key';
import type {SearchScope} from '$lib/search-types';
import {sourceFor,sourceHash,sourceText} from './core.mjs';
import cases from './neighbor-regressions.json';
it.skipIf(!process.env.NEIGHBOR_QUALITY_EVAL)('checks candidate contextual recall and neighboring-source controls',async()=>{
 const files=new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(n=>[n,readFileSync(`static/search/${n}`,'utf8')]));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(files.get(String(url).split('/').pop()!))));
 try{
  resetSearchIndex();await whenSearchComplete();const visible=searchableReportSlugs([],'all');
  for(const q of cases){
   for(const j of q.judgments){
    const report=JSON.parse(readFileSync(`src/lib/data/reports/${j.reportSlug}.json`,'utf8'));
    const source=sourceFor(report,j.chapterIndex);
    expect(sourceHash(source),`${q.id}: reviewed source changed`).toBe(j.sourceHash);
    expect(sourceText(source)).toContain(j.evidence);
   }
   const scope:SearchScope=q.scope==='report'?{kind:'report',label:q.label,reportSlug:q.label}:q.scope==='collection'?{kind:'collection',label:q.label,reportSlugs:collections.find(c=>c.slug===q.label)!.items.filter(s=>visible.includes(s))}:{kind:'archive',label:q.label,reportSlugs:visible};
   const response=await searchScoped(q.query,[scope],q.scope==='archive'?30:120);
   const allowed=scope.kind==='report'?[scope.reportSlug]:scope.reportSlugs;
   expect(response.hits.every(h=>allowed.includes(h.reportSlug))).toBe(true);
   const seen=new Set<string>();
   const hits=response.hits.filter(h=>{const key=searchHitKey(h);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,5);
   expect(q.judgments.filter(j=>j.grade===3).every(j=>hits.some(h=>j.reportSlug===h.reportSlug&&j.chapterIndex===h.chapterIndex)),`${q.id}/${q.label}`).toBe(true);
  }
 }finally{resetSearchIndex();vi.unstubAllGlobals();}
},30000);

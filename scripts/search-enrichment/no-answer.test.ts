import {readFileSync,writeFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {searchScoped,resetSearchIndex,whenSearchComplete} from '$lib/search-core';
import {searchableReportSlugs} from '$lib/search-visibility';
import {collections} from '$lib/data/collections';
import type {SearchScope} from '$lib/search-types';

// Synthetic impossible requests. No claim that all naturally unanswerable
// questions can be detected by lexical evidence.
const negatives = [
 'Техника зюзюбра-91827 с лазерным баклером',
 'Расписание турнира на Марсе 2099',
 'Правила захвата крокозябр-82716',
 'жжщщ ыыъъ',
 'Как парировать телепортацию клинка?',
 'Выпад с антигравитационными ботинками',
 'Как зачаровать баклер заклинанием бессмертия?',
 'Техника фехтования четырьмя руками инопланетянина'
];
it.skipIf(!process.env.NO_ANSWER_EVAL)('compares evidence gates on synthetic absent topics',async()=>{
 const files=new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(n=>[n,readFileSync(`static/search/${n}`,'utf8')]));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(files.get(String(url).split('/').pop()!))));
 const visible=searchableReportSlugs([],'all');
 const collection=collections.find(c=>c.slug==='noname')!;
 const scopes:SearchScope[]=[{kind:'collection',label:'noname',reportSlugs:collection.items.filter(s=>visible.includes(s))},
 {kind:'archive',label:'archive',reportSlugs:visible}];
 const rows:any[]=[];
 try{
  resetSearchIndex();await whenSearchComplete();
  for(const floor of ['off','0','0.35','0.5']){
   vi.stubEnv('VITE_SEARCH_NUMERIC_EVIDENCE',floor==='off'?'0':'1');
   vi.stubEnv('VITE_SEARCH_EVIDENCE_FLOOR',floor==='off'?'0':floor);
   for(const query of negatives)for(const scope of scopes){
    const response=await searchScoped(query,[scope],30);
    expect(response.pending).toBe(false);
    rows.push({floor,query,scope:scope.kind,returned:response.hits.length,matchKind:response.matchKind,
     top:response.hits.slice(0,3).map(h=>({slug:h.reportSlug,title:h.title,snippet:h.snippet}))});
   }
  }
  writeFileSync('docs/search-quality/no-answer-results.json',JSON.stringify({protocol:'Eight synthetic impossible requests; four are new to the previous fencing benchmark. Counts measure nonempty retrieval, not factual answer generation.',rows},null,2)+'\n');
  console.log(['off','0','0.35','0.5'].map(floor=>({floor,falsePositive:rows.filter(r=>r.floor===floor&&r.returned>0).length,n:16})));
 }finally{resetSearchIndex();vi.unstubAllGlobals();vi.unstubAllEnvs();}
},180000);

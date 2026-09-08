import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {it,vi,expect} from 'vitest';
import {searchScoped,whenSearchComplete,resetSearchIndex} from '$lib/search-core';
import {searchableReportSlugs} from '$lib/search-visibility';
it.skipIf(!process.env.RELEVANCE_REVIEW)('captures concrete source hits for evidence review',async()=>{
 const files=new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(n=>[n,readFileSync(`static/search/${n}`,'utf8')]));
 const version=process.env.RELEVANCE_VERSION??'v1';
 if(!['v1','v2'].includes(version))throw Error('Invalid review version');
 const reviewPath=`scripts/search-enrichment/relevance-reviewed-${version}.json`;
 const cases=JSON.parse(readFileSync(reviewPath,'utf8')).cases;
 const visible=searchableReportSlugs([],'all'),rows:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(files.get(String(url).split('/').pop()!))));
 try{
  resetSearchIndex();await whenSearchComplete();
  for(const q of cases){
   const scopes:any[]=[{kind:'archive',label:'archive',reportSlugs:visible}];
   if(q.id==='expanded-5-3-original')scopes.push({kind:'report',label:q.judgments[0].reportSlug,reportSlug:q.judgments[0].reportSlug});
   for(const scope of scopes){const result=await searchScoped(q.query,[scope],120);
    expect(result.hits.every(h=>scope.kind==='report'?h.reportSlug===scope.reportSlug:visible.includes(h.reportSlug))).toBe(true);
    rows.push({id:q.id,query:q.query,scope:scope.kind,hits:result.hits});}
  }
  writeFileSync(version==='v1'?'.codex/relevance-review-hits.json':`.codex/relevance-review-hits-${version}.json`,JSON.stringify({reviewSha256:createHash('sha256').update(readFileSync(reviewPath)).digest('hex'),indexHash:createHash('sha256').update([...files.values()].join('')).digest('hex'),registryHash:createHash('sha256').update(readFileSync('scripts/search-enrichment/pilot-expanded.json')).digest('hex'),rows},null,2)+'\n');
  console.log({questions:cases.length,scenarios:rows.length});
 }finally{resetSearchIndex();vi.unstubAllGlobals();}
},120000);

import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {searchScoped,resetSearchIndex,whenSearchComplete} from '$lib/search-core';
import {searchableReportSlugs} from '$lib/search-visibility';
import {searchHitKey} from '$lib/search-hit-key';

it('keeps the named position in the user query and preserves two working searches',async()=>{
 const files=new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(n=>[n,readFileSync(`static/search/${n}`,'utf8')]));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(files.get(String(url).split('/').pop()!))));
 try{
  resetSearchIndex();await whenSearchComplete();
  const scope={kind:'archive' as const,label:'catalog',reportSlugs:searchableReportSlugs([],'main')};
  for(const query of ['подготовка атаки через длинное острие','подготовка атаки через длинное остриё','силовой батман','перенос уколом']){
   const result=await searchScoped(query,[scope],30),seen=new Set<string>();
   const hits=result.hits.filter(h=>{const key=searchHitKey(h);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,5);
   if(query.startsWith('подготовка')){
    expect(hits.some(h=>(h.reportSlug==='silovye-porezy-katanoy'&&h.chapterIndex===7)||(h.reportSlug==='2026-07-06-19-26-42'&&h.chapterIndex===2))).toBe(true);
    expect(hits[0].kind).not.toBe('report');
   }else{
    expect([hits[0].reportSlug,hits[0].chapterIndex]).toEqual(query==='силовой батман'?['sablya-a-5',1]:['longsword-a',13]);
   }
  }
 }finally{resetSearchIndex();vi.unstubAllGlobals();}
},30000);

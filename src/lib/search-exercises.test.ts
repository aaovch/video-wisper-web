import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {searchScoped,resetSearchIndex,whenSearchComplete} from './search-core';
import {searchHitKey} from './search-hit-key';

it('makes both real jumping exercises reachable from their shared search result title',async()=>{
 const files=new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(n=>[n,readFileSync(`static/search/${n}`,'utf8')]));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(files.get(String(url).split('/').pop()!))));
 try{
  resetSearchIndex();await whenSearchComplete();
  const result=await searchScoped('Прыгайте',[{kind:'report',label:'Меч и баклер',reportSlug:'mech-i-bakler-mikrotsikl-1-osnovy',zones:['additional']}],120);
  const seen=new Set<string>();const visible=result.hits.filter(h=>{const k=searchHitKey(h);if(seen.has(k))return false;seen.add(k);return true;});
  expect(visible.some(h=>h.start===318.39)).toBe(true);
  expect(visible.some(h=>h.start===528.89)).toBe(true);
  const destinations=new Set(visible.map(h=>`${h.href}?t=${h.start}`));
  expect(destinations.size).toBe(visible.length);
 }finally{resetSearchIndex();vi.unstubAllGlobals();}
},30000);

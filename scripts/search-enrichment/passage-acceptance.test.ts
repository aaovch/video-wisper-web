import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import {searchScoped,resetSearchIndex,whenSearchComplete} from '$lib/search-core';
import {searchableReportSlugs} from '$lib/search-visibility';
import {searchHitKey} from '$lib/search-hit-key';
import {collections} from '$lib/data/collections';
import type {SearchScope} from '$lib/search-types';
it.skipIf(!process.env.PASSAGE_ACCEPT_EVAL)('verifies the actual runtime against all frozen baseline scenarios',async()=>{
 const baseline=JSON.parse(readFileSync('docs/search-quality/passage-order.json','utf8'));
 const files=new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(n=>[n,readFileSync(`static/search/${n}`,'utf8')]));
 expect(createHash('sha256').update([...files.values()].join('')).digest('hex')).toBe(baseline.indexHash);
 const registries=Object.fromEntries(Object.entries(baseline.hashes).map(([name,hash])=>{const raw=readFileSync(`scripts/search-enrichment/${name}.json`,'utf8');expect(createHash('sha256').update(raw).digest('hex')).toBe(hash);return[name,JSON.parse(raw)];}));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(files.get(String(url).split('/').pop()!))));
 const rows:any[]=[];
 try{
  resetSearchIndex();await whenSearchComplete();
  for(const r of baseline.rows){
   const registry=registries[r.registry],q=registry.cases.find((q:any)=>q.id===r.id);
   const visible=searchableReportSlugs(registry.protocol.unlockedHemaCollections?collections.filter(c=>c.hema).map(c=>c.slug):[],'all');
   const scope:SearchScope=r.scope==='report'?{kind:'report',label:r.label,reportSlug:r.label}:r.scope==='collection'?{kind:'collection',label:r.label,reportSlugs:collections.find(c=>c.slug===r.label)!.items.filter(s=>visible.includes(s))}:{kind:'archive',label:r.label,reportSlugs:visible};
   const response=await searchScoped(q.query,[scope],r.scope==='archive'?30:120),seen=new Set<string>();
   const allowed=scope.kind==='report'?[scope.reportSlug]:scope.reportSlugs;
   expect(response.hits.every(h=>allowed.includes(h.reportSlug))).toBe(true);
   const hits=response.hits.filter(h=>{const key=searchHitKey(h);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,5);
   const expected=q.judgments.filter((j:any)=>j.grade===3),found=expected.filter((j:any)=>hits.some(h=>h.reportSlug===j.reportSlug&&h.chapterIndex===j.chapterIndex)).length;
   const hit5=found>0,coverage5=expected.length?found/expected.length:null,old=r.variants.current;
   expect(!old.hit5||hit5,`${r.id}/${r.scope} lost Hit@5`).toBe(true);
   if(r.kind==='multi')expect(coverage5,`${r.id}/${r.scope} lost source coverage`).toBeGreaterThanOrEqual(old.coverage5);
   rows.push({id:r.id,scope:r.scope,label:r.label,kind:r.kind,beforeHit5:old.hit5,hit5,beforeCoverage5:old.coverage5,coverage5});
  }
  writeFileSync('docs/search-quality/passage-acceptance.json',JSON.stringify({indexHash:baseline.indexHash,scenarios:rows.length,losses:0,gains:rows.filter(r=>r.kind==='single'&&!r.beforeHit5&&r.hit5).length,multiGains:rows.filter(r=>r.kind==='multi'&&r.coverage5>r.beforeCoverage5).length,rows},null,2)+'\n');
 }finally{resetSearchIndex();vi.unstubAllGlobals();}
},300000);

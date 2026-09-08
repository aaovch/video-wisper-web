import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {expect,it,vi} from 'vitest';
import {searchScoped,resetSearchIndex,whenSearchComplete} from '$lib/search-core';
import {searchableReportSlugs} from '$lib/search-visibility';
import {collections} from '$lib/data/collections';
import type {SearchScope} from '$lib/search-types';
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
it.skipIf(!process.env.PILOT_SEARCH_STAGE)('evaluates frozen situation questions without changing judgments',async()=>{
 const registryPath=process.env.PILOT_REGISTRY??'scripts/search-enrichment/pilot-registry.json';
 const tag=process.env.PILOT_TAG??(process.env.PILOT_REGISTRY?'confirmation-':'');
 if(!/^[a-z0-9-]*$/.test(tag))throw Error('Invalid pilot tag');
 const raw=readFileSync(registryPath,'utf8');
 expect(hash(raw)).toBe(readFileSync(registryPath.replace(/\.json$/,'.sha256'),'utf8').trim());
 const registry=JSON.parse(raw),split=process.env.PILOT_SPLIT??'development';
 const cases=registry.cases.filter((q:any)=>q.split===split);
 if(registry.protocol.cardFingerprint){
  const fingerprint=createHash('sha256');
  for(const slug of new Set<string>(cases.flatMap((q:any)=>q.judgments.map((j:any)=>j.reportSlug))))
   fingerprint.update(readFileSync(`src/lib/data/search-cards/${slug}.json`));
  expect(fingerprint.digest('hex')).toBe(registry.protocol.cardFingerprint);
 }
 const files=new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(n=>[n,readFileSync(`static/search/${n}`,'utf8')]));
 const unlocked=registry.protocol.unlockedHemaCollections?collections.filter(c=>c.hema).map(c=>c.slug):[];
 const visible=searchableReportSlugs(unlocked,'all'),rows:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(files.get(String(url).split('/').pop()!))));
 try{
  resetSearchIndex();const started=performance.now();await whenSearchComplete();const loadMs=performance.now()-started;
  for(const q of cases){
   const slug=q.judgments[0].reportSlug;
   expect(visible).toContain(slug);
   const scopes:SearchScope[]=[];
   if(q.scopes.includes('report'))scopes.push({kind:'report',label:slug,reportSlug:slug});
   if(q.scopes.includes('collection'))for(const c of collections.filter(c=>(!c.password||unlocked.includes(c.slug))&&c.items.includes(slug)))
    scopes.push({kind:'collection',label:c.slug,reportSlugs:c.items.filter(s=>visible.includes(s))});
   if(q.scopes.includes('archive'))scopes.push({kind:'archive',label:'archive',reportSlugs:visible});
   const expected=q.judgments.filter((j:any)=>j.grade===3).map((j:any)=>`${j.reportSlug}:${j.chapterIndex}`);
   for(const scope of scopes){
    const t=performance.now();const response=await searchScoped(q.query,[scope],scope.kind==='archive'?30:120);const ms=performance.now()-t;
    expect(response.pending).toBe(false);
    const allowed=scope.kind==='report'?[scope.reportSlug]:scope.reportSlugs;
    expect(response.hits.every(h=>allowed.includes(h.reportSlug))).toBe(true);
    const hits=[...new Map(response.hits.map(h=>[h.chapterIndex!=null?`${h.reportSlug}:${h.chapterIndex}`:`${h.reportSlug}:${h.kind}:${h.title}`,h])).entries()];
    const rank=hits.findIndex(([key])=>expected.includes(key))+1;
    const found=hits.slice(0,5).filter(([key])=>expected.includes(key)).length;
    rows.push({id:q.id,kind:q.kind,coverage:q.coverage,scope:scope.kind,label:scope.label,ms,rank,hit5:rank>0&&rank<=5,
     sourceCoverage5:expected.length?found/expected.length:null,knownSupportPrecision5:expected.length&&hits.length?found/Math.min(5,hits.length):null,
     mrr:rank>0&&rank<=10?1/rank:0,returned:hits.length,matchKind:response.matchKind,
     ranking:hits.slice(0,10).map(([key])=>key)});
   }
  }
  mkdirSync('.codex/search-pilot',{recursive:true});
  writeFileSync(`.codex/search-pilot/${tag}${split}-${process.env.PILOT_SEARCH_STAGE}.json`,JSON.stringify({split,registryHash:hash(raw),indexHash:hash([...files.values()].join('')),
   loadMs,coreBytes:Buffer.byteLength(files.get('index-core.json')!),coreGzipBytes:gzipSync(files.get('index-core.json')!).length,rows},null,2)+'\n');
  console.log({split,questions:cases.length,scenarios:rows.length,hit5:rows.filter(r=>r.kind==='single'&&r.hit5).length});
 }finally{resetSearchIndex();vi.unstubAllGlobals();}
},600000);

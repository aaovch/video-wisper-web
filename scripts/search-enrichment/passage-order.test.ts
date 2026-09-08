import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import {searchScoped,resetSearchIndex,whenSearchComplete} from '$lib/search-core';
import {searchableReportSlugs} from '$lib/search-visibility';
import {searchHitKey} from '$lib/search-hit-key';
import {orderSearchPassages} from '$lib/search-passage-order';
import {collections} from '$lib/data/collections';
import type {SearchHit,SearchScope} from '$lib/search-types';
const modes=['current','passages-first','keep-two','boost-125','boost-150'] as const;
function reorder(hits:SearchHit[],mode:string){
 if(mode==='current')return hits;
 if(mode==='passages-first')return orderSearchPassages(hits,'semantic');
 const score=(h:SearchHit)=>h.score*(h.chapterIndex!=null?(mode==='boost-125'?1.25:1.5):1);
 if(mode.startsWith('boost'))return [...hits].sort((a,b)=>score(b)-score(a));
 const n=mode==='keep-two'?2:0,tail=hits.slice(n);
 return [...hits.slice(0,n),...tail.filter(h=>h.chapterIndex!=null),...tail.filter(h=>h.chapterIndex==null)];
}
it.skipIf(!process.env.PASSAGE_ORDER_EVAL)('compares passage ordering on frozen sources without editing production ranking',async()=>{
 const files=new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(n=>[n,readFileSync(`static/search/${n}`,'utf8')]));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(files.get(String(url).split('/').pop()!))));
 const rows:any[]=[],hashes:any={};
 try{
  vi.stubEnv('VITE_SEARCH_PASSAGES_FIRST','0');resetSearchIndex();await whenSearchComplete();
  for(const name of ['pilot-registry','pilot-expanded','noname-registry','context-registry']){
   const raw=readFileSync(`scripts/search-enrichment/${name}.json`,'utf8'),registry=JSON.parse(raw);
   hashes[name]=createHash('sha256').update(raw).digest('hex');
   expect(hashes[name]).toBe(readFileSync(`scripts/search-enrichment/${name}.sha256`,'utf8').trim());
   const unlocked=registry.protocol.unlockedHemaCollections?collections.filter(c=>c.hema).map(c=>c.slug):[],visible=searchableReportSlugs(unlocked,'all');
   for(const q of registry.cases){
    const slug=q.judgments[0].reportSlug,scopes:SearchScope[]=[];
    if(!visible.includes(slug))continue;
    if(q.scopes.includes('report'))scopes.push({kind:'report',label:slug,reportSlug:slug});
    if(q.scopes.includes('collection'))for(const c of collections.filter(c=>(!c.password||unlocked.includes(c.slug))&&c.items.includes(slug)))scopes.push({kind:'collection',label:c.slug,reportSlugs:c.items.filter(s=>visible.includes(s))});
    if(q.scopes.includes('archive'))scopes.push({kind:'archive',label:'archive',reportSlugs:visible});
    for(const scope of scopes){
     const result=await searchScoped(q.query,[scope],scope.kind==='archive'?30:120);
     const expected=q.judgments.filter((j:any)=>j.grade===3).map((j:any)=>`${j.reportSlug}:${j.chapterIndex}`);
     const variants=Object.fromEntries(modes.map(mode=>{
      const reordered=result.matchKind==='semantic'?reorder(result.hits,mode):result.hits,seen=new Set<string>();
      const unique=reordered.filter(h=>{const k=searchHitKey(h);if(seen.has(k))return false;seen.add(k);return true;});
      const keys=unique.map(h=>`${h.reportSlug}:${h.chapterIndex}`),rank=keys.findIndex(k=>expected.includes(k))+1;
      return [mode,{hit5:rank>0&&rank<=5,rank,coverage5:expected.length?expected.filter(k=>keys.slice(0,5).includes(k)).length/expected.length:null,top5:unique.slice(0,5).map(searchHitKey)}];
     }));
     rows.push({registry:name,id:q.id,query:q.query,kind:q.kind,scope:scope.kind,label:scope.label,matchKind:result.matchKind,variants});
    }
   }
  }
  const summary=modes.map(mode=>({mode,singleHit5:rows.filter(r=>r.kind==='single'&&r.variants[mode].hit5).length,losses:rows.filter(r=>r.variants.current.hit5&&!r.variants[mode].hit5).map(r=>`${r.id}/${r.scope}/${r.label}`),multiCoverage:rows.filter(r=>r.kind==='multi').reduce((s,r)=>s+r.variants[mode].coverage5,0),sourceLosses:rows.filter(r=>r.kind==='multi'&&r.variants[mode].coverage5<r.variants.current.coverage5).map(r=>`${r.id}/${r.label}`)}));
  writeFileSync('docs/search-quality/passage-order.json',JSON.stringify({protocol:'Disclosed source-aware evaluation, no fresh holdout. Production unchanged. Multi-source labels retain documented limitations.',indexHash:createHash('sha256').update([...files.values()].join('')).digest('hex'),hashes,scenarios:rows.length,summary,rows},null,2)+'\n');
  console.log(JSON.stringify({scenarios:rows.length,summary}));
 }finally{resetSearchIndex();vi.unstubAllGlobals();vi.unstubAllEnvs();}
},300000);

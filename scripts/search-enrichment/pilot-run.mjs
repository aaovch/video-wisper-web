import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const split=process.env.PILOT_SPLIT??'development';
const tag=process.env.PILOT_TAG??(process.env.PILOT_REGISTRY?'confirmation-':'');
 if(!/^[a-z0-9-]*$/.test(tag))throw Error('Invalid pilot tag');
if(!['development','holdout'].includes(split))throw Error('Invalid split');
const run=(args,env)=>{const r=spawnSync(process.execPath,args,{env,stdio:'inherit'});if(r.status!==0)throw Error(`Failed ${args.join(' ')}`);};
if(!process.argv.includes('--summarize-only'))try{
 run(['node_modules/vitest/vitest.mjs','run','scripts/search-enrichment/cards.test.ts'],process.env);
 for(const [name,cards]of [['baseline','0'],['cards','1']]){
  const env={...process.env,SEARCH_CARDS:cards,SEARCH_CHAPTER_BODY:'0',SEARCH_SIGNAL_TERMS:'0',PILOT_SPLIT:split,PILOT_SEARCH_STAGE:name};
  run(['scripts/build-search-index.mjs'],env);
  run(['node_modules/vitest/vitest.mjs','run','scripts/search-enrichment/pilot.test.ts','--pool=threads','--maxWorkers=1','--no-file-parallelism'],env);
 }
}finally{run(['scripts/build-search-index.mjs'],process.env);}
const load=name=>JSON.parse(readFileSync(`.codex/search-pilot/${tag}${split}-${name}.json`,'utf8'));
const before=load('baseline'),after=load('cards');
if(before.registryHash!==after.registryHash||before.rows.length!==after.rows.length)throw Error('Unpaired corpus');
const losses=[],sourceLosses=[];
for(const [i,r]of after.rows.entries()){
 const b=before.rows[i];if(r.id!==b.id||r.scope!==b.scope||r.label!==b.label)throw Error('Unpaired task');
 if(b.hit5&&!r.hit5)losses.push({id:r.id,scope:r.scope,label:r.label,before:b.rank,after:r.rank});
 if(r.kind==='multi'&&r.sourceCoverage5<b.sourceCoverage5)sourceLosses.push({id:r.id,before:b.sourceCoverage5,after:r.sourceCoverage5});
}
const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.max(0,Math.ceil(a.length*p)-1)]??0;
function summarize(data){
 return {loadMs:data.loadMs,coreGzipBytes:data.coreGzipBytes,groups:['report','collection','archive'].map(scope=>{
  const rows=data.rows.filter(r=>r.scope===scope&&r.kind==='single');
  return {scope,n:rows.length,hit5:rows.filter(r=>r.hit5).length,mrr:rows.reduce((n,r)=>n+r.mrr,0)/(rows.length||1),p95:percentile(rows.map(r=>r.ms),.95)};
 }),multi:data.rows.filter(r=>r.kind==='multi').map(r=>({id:r.id,coverage5:r.sourceCoverage5})),
 unsupported:{n:data.rows.filter(r=>r.kind==='unsupported').length,nonempty:data.rows.filter(r=>r.kind==='unsupported'&&r.returned).length,
 note:'Related sources can be useful; nonempty retrieval is not a claim to know a personal fact.'}};
}
const b=summarize(before),a=summarize(after),bc=b.groups.find(g=>g.scope==='collection'),ac=a.groups.find(g=>g.scope==='collection');
const gain=ac.hit5/ac.n-bc.hit5/bc.n;
const summary={split,registryHash:before.registryHash,before:b,after:a,losses,sourceLosses,collectionGain:gain,
 gates:{collectionGain10pp:gain>=.1,noIndividualHit5Loss:!losses.length,noMultiSourceCoverageLoss:!sourceLosses.length,coreGzipGrowth20pct:after.coreGzipBytes<=before.coreGzipBytes*1.2,
 warmP95Growth10pct:a.groups.every((g,i)=>g.p95<=b.groups[i].p95*1.1)},
 caveat:'Same author, incomplete relevance judgments. Node timings are not mobile UX evidence. Holdout results are disclosed once run.'};
writeFileSync(`docs/search-quality/pilot-${tag}${split}.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));

import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const path='src/lib/data/search-cards/mech-i-bakler-mikrotsikl-1-osnovy.json';
const before=readFileSync(path),candidate='.codex/search-cards/conditions-candidate.json';
const registry=JSON.parse(readFileSync('scripts/search-enrichment/conditions-registry.json','utf8'));
if(hash(readFileSync(candidate))!==registry.protocol.candidateSha256)throw Error('Candidate changed');
const run=(args,env=process.env)=>{const r=spawnSync(process.execPath,args,{env,stdio:'inherit'});if(r.status!==0)throw Error('Failed '+args.join(' '));};
try{
 for(const stage of ['current','candidate']){
  if(stage==='candidate'){
   run(['scripts/search-enrichment/cards-cli.mjs','import','mech-i-bakler-mikrotsikl-1-osnovy',candidate,'--dry-run']);
   run(['scripts/search-enrichment/cards-cli.mjs','import','mech-i-bakler-mikrotsikl-1-osnovy',candidate]);
  }
  run(['scripts/build-search-index.mjs']);
  run(['node_modules/vitest/vitest.mjs','run','scripts/search-enrichment/pilot.test.ts','--pool=threads','--maxWorkers=1','--no-file-parallelism'],{...process.env,PILOT_REGISTRY:'scripts/search-enrichment/conditions-registry.json',PILOT_TAG:'conditions-',PILOT_SPLIT:'holdout',PILOT_SEARCH_STAGE:stage});
 }
}finally{
 const activeHash=hash(readFileSync(path));
 if(activeHash!==hash(before)&&activeHash!==registry.protocol.candidateSha256){
  writeFileSync('.codex/search-cards/conditions-baseline-recovery.json',before);
  throw Error('Card file changed outside this experiment; preserved it and saved the original backup.');
 }
 writeFileSync(path,before);run(['scripts/build-search-index.mjs']);
}
if(hash(readFileSync(path))!==hash(before))throw Error('Restore failed');
const read=s=>JSON.parse(readFileSync(`.codex/search-pilot/conditions-holdout-${s}.json`,'utf8'));
const b=read('current'),a=read('candidate');
if(b.registryHash!==a.registryHash||b.rows.length!==a.rows.length)throw Error('Unpaired');
const losses=a.rows.flatMap((r,i)=>{const old=b.rows[i];if(r.id!==old.id||r.scope!==old.scope||r.label!==old.label)throw Error('Unpaired row');return old.hit5&&!r.hit5?[{id:r.id,scope:r.scope,label:r.label,before:old.rank,after:r.rank}]:[];});
const groups=['report','collection','archive'].map(scope=>{const x=b.rows.filter(r=>r.scope===scope),y=a.rows.filter(r=>r.scope===scope);return {scope,n:x.length,before:x.filter(r=>r.hit5).length,after:y.filter(r=>r.hit5).length};});
const collection=groups.find(g=>g.scope==='collection');
const result={protocol:registry.protocol,registryHash:b.registryHash,beforeIndexHash:b.indexHash,afterIndexHash:a.indexHash,groups,losses,coreGzipBefore:b.coreGzipBytes,coreGzipAfter:a.coreGzipBytes,gates:{collectionGain10pp:(collection.after-collection.before)/collection.n>=.1,noIndividualLoss:!losses.length},restoredAcceptedCards:true};
writeFileSync('docs/search-quality/conditions-candidate.json',JSON.stringify(result,null,2)+'\n');console.log(result);

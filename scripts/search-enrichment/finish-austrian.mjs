import {readFileSync,writeFileSync,unlinkSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const registry=JSON.parse(readFileSync('scripts/search-enrichment/austrian-registry.json','utf8'));
const stages=['before','after','no-expansion','distinct','literal'];
const runs=Object.fromEntries(stages.map(s=>[s,JSON.parse(readFileSync(`.codex/search-pilot/austrian-holdout-${s}.json`,'utf8'))]));
const baseline=runs.before;
const summary=Object.fromEntries(Object.entries(runs).map(([stage,data])=>{
 if(data.registryHash!==baseline.registryHash||data.rows.length!==baseline.rows.length)throw Error('Unpaired registry');
 const losses=data.rows.flatMap((r,i)=>{
  const b=baseline.rows[i];if(r.id!==b.id||r.scope!==b.scope||r.label!==b.label)throw Error('Unpaired rows');
  return b.hit5&&!r.hit5?[{id:r.id,scope:r.scope,before:b.rank,after:r.rank}]:[];
 });
 return [stage,{indexHash:data.indexHash,coreGzipBytes:data.coreGzipBytes,groups:['report','collection','archive'].map(scope=>({scope,n:data.rows.filter(r=>r.scope===scope).length,hit5:data.rows.filter(r=>r.scope===scope&&r.hit5).length})),losses}];
}));
// Only remove the two files created by this experiment, after checking their exact bytes.
for(const [slug,sha]of Object.entries(registry.protocol.candidateHashes)){
 const path=`src/lib/data/search-cards/${slug}.json`;
 if(existsSync(path)&&hash(readFileSync(path))!==sha)throw Error(`External change preserved: ${path}`);
}
for(const slug of Object.keys(registry.protocol.candidateHashes)){
 const path=`src/lib/data/search-cards/${slug}.json`;if(existsSync(path))unlinkSync(path);
}
writeFileSync('docs/search-quality/austrian-batch.json',JSON.stringify({registryHash:baseline.registryHash,protocol:registry.protocol,summary,accepted:false,reason:'No collection Hit@5 gain. New cards removed, diagnostic runtime flags removed; candidates remain reproducible from source-reviewed script.',qualityGateFailure:{id:'q07',scope:'collection',rawRank:6,note:'Also occurs after candidate removal. Concurrent report edits and raw duplicate-counting prevent attribution to this candidate; UI-aligned evaluation retains the same expected sources.'}},null,2)+'\n');
console.log({accepted:false,restoredSidecars:true,summary});

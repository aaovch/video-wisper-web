import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const legacy=process.argv.includes('--legacy'),confirmation=process.argv.includes('--confirmation');
const jobs=confirmation?[{registry:'neighbor-confirmation',split:'holdout'}]:legacy?['development','holdout'].map(split=>({registry:'pilot-registry',split})):['pilot-expanded','noname-registry','context-registry'].map(registry=>({registry,split:'holdout'}));
const clean={...process.env};delete clean.SEARCH_NEIGHBOR_CONTEXT;delete clean.VITE_SEARCH_PASSAGES_FIRST;
function run(args,env=clean){const r=spawnSync(process.execPath,args,{env,encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error(`${args.join(' ')}\n${r.stdout}\n${r.stderr}`);}
try{
 for(const stage of ['before','after']){
  run(['scripts/build-search-index.mjs'],{...clean,SEARCH_NEIGHBOR_CONTEXT:stage==='after'?'1':'0'});
  for(const {registry,split} of jobs){
   run(['node_modules/vitest/vitest.mjs','run','scripts/search-enrichment/pilot.test.ts'],{...clean,PILOT_REGISTRY:`scripts/search-enrichment/${registry}.json`,PILOT_TAG:`neighbor-${registry}-`,PILOT_SPLIT:split,PILOT_SEARCH_STAGE:stage});
   console.log(`${stage}: ${registry}`);
  }
 }
 const comparisons=jobs.map(({registry,split})=>{
  const read=stage=>JSON.parse(readFileSync(`.codex/search-pilot/neighbor-${registry}-${split}-${stage}.json`,'utf8'));
  const b=read('before'),a=read('after');if(b.registryHash!==a.registryHash||b.rows.length!==a.rows.length)throw Error('Unpaired registry');
  const losses=[],gains=[],multi=[];
  a.rows.forEach((r,i)=>{const p=b.rows[i];if(p.id!==r.id||p.scope!==r.scope||p.label!==r.label)throw Error('Unpaired row');
   if(p.hit5&&!r.hit5)losses.push({id:r.id,scope:r.scope,label:r.label});
   if(!p.hit5&&r.hit5)gains.push({id:r.id,scope:r.scope,label:r.label});
   if(r.kind==='multi')multi.push({id:r.id,scope:r.scope,label:r.label,before:p.sourceCoverage5,after:r.sourceCoverage5});
  });
  return {registry,split,scenarios:a.rows.length,registryHash:a.registryHash,beforeIndexHash:b.indexHash,afterIndexHash:a.indexHash,gzipBefore:b.coreGzipBytes,gzipAfter:a.coreGzipBytes,losses,gains,multi};
 });
 const result={protocol:'Disclosed questions, literal adjacent chapter titles in contextual field; production default unchanged.',comparisons};
 writeFileSync(`docs/search-quality/neighbor-context${confirmation?'-confirmation':legacy?'-legacy':''}.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{run(['scripts/build-search-index.mjs']);console.log('Restored default index');}

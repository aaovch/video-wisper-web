import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const variants=[['baseline','0','0'],['chapters','1','0'],['coverage','0','1'],['combined','1','1']]
 .filter(([name])=>!process.env.SEARCH_RANK_VARIANTS||process.env.SEARCH_RANK_VARIANTS.split(',').includes(name));
if(!variants.some(([name])=>name==='baseline'))throw Error('Include baseline in SEARCH_RANK_VARIANTS');
const tag=process.env.FENCING_FIXTURE?'holdout-':'';
function run(args,env){const r=spawnSync(process.execPath,args,{stdio:'inherit',env});if(r.error)throw r.error;if(r.status!==0)throw Error(`Exit ${r.status}`);}
if(!process.argv.includes('--summarize-only'))try{
 for(const [name,body,coverage] of variants){
  const env={...process.env,SEARCH_ENRICHMENT:'1',SEARCH_ENRICHMENT_EXCLUDE:'',SEARCH_CHAPTER_BODY:body,SEARCH_SIGNAL_TERMS:coverage,FENCING_SEARCH:`ranking-${tag}${name}`};
  run(['scripts/build-search-index.mjs'],env);
  run(['node_modules/vitest/vitest.mjs','run','scripts/search-enrichment/fencing.test.ts','--pool=threads','--maxWorkers=1','--no-file-parallelism'],env);
 }
}finally{run(['scripts/build-search-index.mjs'],process.env);}
const results=variants.map(([name])=>{
 const data=JSON.parse(readFileSync(`.codex/search-fencing/ranking-${tag}${name}.json`,'utf8'));
 return {name,...data,rows:data.rows.filter(r=>['report','collection','archive'].includes(r.area))};
});
const base=results[0];
const summary=[];
for(const result of results){
 if(result.fixtureHash!==base.fixtureHash||result.rows.length!==base.rows.length)throw Error('Unpaired evaluation');
 const groups=new Map();const regressions=[];
 for(const [i,row]of result.rows.entries()){
  const original=base.rows[i];
  if(row.id!==original.id||row.area!==original.area||row.collection!==original.collection)throw Error('Task mismatch');
  const key=row.area+(row.collection?':'+row.collection:'');
  if(!groups.has(key))groups.set(key,{area:key,n:0,hit3:0,hit5:0,mrr10:0,negative:0,falsePositive:0});
  const g=groups.get(key);
  if(row.negative){g.negative++;g.falsePositive+=+(row.returned>0);continue;}
  g.n++;g.hit3+=row.hit3;g.hit5+=row.hit5;g.mrr10+=row.mrr10;
  if(original.hit5&&!row.hit5)regressions.push({id:row.id,area:key,before:original.rank,after:row.rank,query:row.query});
 }
 for(const g of groups.values())g.mrr10=g.n?g.mrr10/g.n:0;
 summary.push({variant:result.name,indexHash:result.indexHash,groups:[...groups.values()],regressions});
}
mkdirSync('docs/search-quality/fencing',{recursive:true});
writeFileSync(`docs/search-quality/fencing/ranking${tag?'-holdout':''}.json`,JSON.stringify({protocol:'Fixed factorial experiment: full title/summary/theses in chapter document; indexed source/expansion stems for semantic coverage only. Synthetic questions; see fixture protocol.',fixtureProtocol:base.protocol,fixtureHash:base.fixtureHash,summary},null,2)+'\n');
console.log(JSON.stringify(summary.map(s=>({variant:s.variant,groups:s.groups.filter(g=>g.area==='archive'||g.area.startsWith('collection:')),regressions:s.regressions.length})),null,2));

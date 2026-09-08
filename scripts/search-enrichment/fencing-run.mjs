import {spawnSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const slugs=['hema-prednamerennye-ekspromtnye','ukol-po-centralnoy-linii','soedinenie-dlinnyi-mech-lager-noname-1'];
const normal={...process.env,SEARCH_ENRICHMENT:'1',SEARCH_ENRICHMENT_EXCLUDE:''};
function run(args,env=normal){const r=spawnSync(process.execPath,args,{stdio:'inherit',env});if(r.error)throw r.error;if(r.status!==0)throw Error(`Command failed (${r.status}): ${args.join(' ')}`);}
try{
	for(const stage of ['before','after']){
		const env={...normal,FENCING_SEARCH:stage,SEARCH_ENRICHMENT_EXCLUDE:stage==='before'?slugs.join(','):''};
		run(['scripts/build-search-index.mjs'],env);
		run(['node_modules/vitest/vitest.mjs','run','scripts/search-enrichment/fencing.test.ts'],env);
	}
}finally{run(['scripts/build-search-index.mjs']);}
const read=stage=>JSON.parse(readFileSync(`.codex/search-fencing/${stage}.json`,'utf8'));
const a=read('before'),b=read('after');
if(a.fixtureHash!==b.fixtureHash||a.rows.length!==b.rows.length)throw Error('Unpaired tasks');
const groups=new Map(),differences=[];
for(let i=0;i<a.rows.length;i++){
	const x=a.rows[i],y=b.rows[i];
	if(x.id!==y.id||x.area!==y.area||x.collection!==y.collection||x.query!==y.query)throw Error('Task order changed');
	const key=x.area+(x.collection?':'+x.collection:'');
	if(!groups.has(key))groups.set(key,{area:key,scopeSize:x.scopeSize,count:0,beforeHit3:0,afterHit3:0,beforeHit5:0,afterHit5:0,beforeMRR:0,afterMRR:0,negative:0,beforeFalsePositive:0,afterFalsePositive:0});
	const g=groups.get(key);
	if(x.negative){g.negative++;g.beforeFalsePositive+=+(x.returned>0);g.afterFalsePositive+=+(y.returned>0);continue;}
	g.count++;g.beforeHit3+=x.hit3;g.afterHit3+=y.hit3;g.beforeHit5+=x.hit5;g.afterHit5+=y.hit5;g.beforeMRR+=x.mrr10;g.afterMRR+=y.mrr10;
	if(x.rank!==y.rank||x.fallback!==y.fallback)differences.push({id:x.id,query:x.query,area:key,beforeRank:x.rank,afterRank:y.rank,beforeFallback:x.fallback,afterFallback:y.fallback,afterTop:y.ranking.slice(0,5)});
}
for(const g of groups.values()){g.beforeMRR=g.count?g.beforeMRR/g.count:0;g.afterMRR=g.count?g.afterMRR/g.count:0;}
const result={protocol:a.protocol,enrichedReports:slugs,addedChapters:55,fixtureHash:a.fixtureHash,beforeIndex:a.indexHash,afterIndex:b.indexHash,scenarios:a.rows.length,groups:[...groups.values()],differences};
mkdirSync('docs/search-quality/fencing',{recursive:true});
writeFileSync('docs/search-quality/fencing/results.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({scenarios:result.scenarios,groups:result.groups,changed:differences.length},null,2));
if(result.groups.some(g=>g.afterHit5<g.beforeHit5||g.afterFalsePositive>g.beforeFalsePositive))throw Error('Fencing enrichment regressed Hit@5 or increased false positives; inspect results.json');

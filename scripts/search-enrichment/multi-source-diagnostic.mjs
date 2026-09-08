import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const inputs=[['scripts/search-enrichment/pilot-registry.json','.codex/search-pilot/expanded-regression-development-cards.json'],['scripts/search-enrichment/pilot-registry.json','.codex/search-pilot/expanded-regression-holdout-cards.json'],['scripts/search-enrichment/pilot-expanded.json','.codex/search-pilot/expanded-holdout-cards.json']];
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const datasets=inputs.map(([registry,path])=>({path,cases:read(registry).cases,rows:read(path).rows}));
const chapter=k=>/^[^:]+:\d+$/.test(k);
const report=k=>k.split(':')[0];
function reorder(keys,mode){
 let ordered=[...keys];
 if(mode.includes('chapters'))ordered.sort((a,b)=>Number(chapter(b))-Number(chapter(a)));
 if(mode.includes('cap2')){
  const selected=[],deferred=[],counts=new Map();
  for(const key of ordered){const s=report(key),n=counts.get(s)??0;if(n>=2)deferred.push(key);else {selected.push(key);counts.set(s,n+1);}}
  ordered=[...selected,...deferred];
 }
 return ordered;
}
const variants=['baseline','chapters','cap2','chapters-cap2'].map(mode=>{
 const losses=[],multi=[];let single=0,hits=0;
 for(const d of datasets)for(const r of d.rows){
  const q=d.cases.find(q=>q.id===r.id);if(!q)throw Error('Unknown query');
  const expected=q.judgments.filter(j=>j.grade===3).map(j=>`${j.reportSlug}:${j.chapterIndex}`);
  const selected=(r.matchKind==='semantic'?reorder(r.ranking,mode):r.ranking).slice(0,5);
  const found=selected.filter(k=>expected.includes(k)).length;
  if(q.kind==='single'){
   single++;hits+=Number(found>0);
   if(r.hit5&&!found)losses.push({id:r.id,scope:r.scope,label:r.label,query:q.query});
  }
  if(q.kind==='multi')multi.push({id:r.id,query:q.query,expected,baseline:r.sourceCoverage5,after:found/expected.length,
   availableInTop10:r.ranking.filter(k=>expected.includes(k)).length/expected.length});
 }
 return {mode,single,hit5:hits,losses,multi,meanMultiCoverage:multi.reduce((s,r)=>s+r.after,0)/multi.length};
});
const result={protocol:'Diagnostic only: reorder the same saved top 10 candidates; never add sources, change judgments or exact-match results. All questions are disclosed. Not a fresh holdout or production ranking change.',
 inputs:inputs.map(([registry,path])=>({registry,path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})),variants};
writeFileSync('docs/search-quality/multi-source-diagnostic.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(variants.map(v=>({mode:v.mode,single:v.single,hit5:v.hit5,losses:v.losses.length,meanMultiCoverage:v.meanMultiCoverage,multiLosses:v.multi.filter(m=>m.after<m.baseline).length})),null,2));
console.log(JSON.stringify(variants[0].multi.map(m=>({id:m.id,baseline:m.baseline,availableInTop10:m.availableInTop10})),null,2));

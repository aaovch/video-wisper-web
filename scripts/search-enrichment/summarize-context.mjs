import {readFileSync,writeFileSync} from 'node:fs';
import {fencingCoverage} from './coverage.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const pairs=[['expanded','all-fencing-holdout-before','all-fencing-holdout-after'],['noname','noname-new-holdout-revised','all-fencing-noname-holdout-after'],['context','context-holdout-before','context-holdout-after']];
const comparisons=pairs.map(([tag,before,after])=>{
 const b=read(`.codex/search-pilot/${before}.json`),a=read(`.codex/search-pilot/${after}.json`);
 if(b.registryHash!==a.registryHash||b.rows.length!==a.rows.length)throw Error('Unpaired registry');
 const losses=[],sourceLosses=[];
 a.rows.forEach((r,i)=>{const p=b.rows[i];if(p.id!==r.id||p.scope!==r.scope||p.label!==r.label)throw Error('Unpaired scenario');if(p.hit5&&!r.hit5)losses.push(r);if(r.kind==='multi'&&r.sourceCoverage5<p.sourceCoverage5)sourceLosses.push(r);});
 return {tag,registryHash:a.registryHash,beforeIndexHash:b.indexHash,afterIndexHash:a.indexHash,scenarios:a.rows.length,losses,sourceLosses,coreGzipBefore:b.coreGzipBytes,coreGzipAfter:a.coreGzipBytes,groups:['report','collection','archive'].map(scope=>({scope,n:a.rows.filter(r=>r.kind==='single'&&r.scope===scope).length,beforeHit5:b.rows.filter(r=>r.kind==='single'&&r.scope===scope&&r.hit5).length,afterHit5:a.rows.filter(r=>r.kind==='single'&&r.scope===scope&&r.hit5).length}))};
});
if(comparisons.some(c=>c.losses.length||c.sourceLosses.length))throw Error('Regression');
const coverage=fencingCoverage();
if(coverage.complete!==coverage.total)throw Error('Incomplete fencing coverage');
const result={date:'2026-09-08',collections:coverage.collections.length,reports:coverage.total,modes:Object.fromEntries(['situational-rewrite','extractive-context'].map(mode=>{const rows=coverage.reports.filter(r=>r.sourceMode===mode);return[mode,{reports:rows.length,chapters:rows.reduce((s,r)=>s+r.total,0)}];})),comparisons,caveats:['New sample is same-author and source-aware, not independent holdout.','Extractive mode copies existing report/chapter titles; no new model call or inferred technique.','Coverage does not prove relevance for every possible question. Compound-source completeness remains unresolved.','Gated collections are evaluated as unlocked; application visibility is unchanged.']};
writeFileSync('docs/search-quality/all-fencing.json',JSON.stringify(result,null,2)+'\n');
const registry=read('scripts/search-enrichment/context-registry.json'),evaluation=read('.codex/search-pilot/context-holdout-after.json');
writeFileSync('scripts/search-enrichment/context-regressions.json',JSON.stringify(evaluation.rows.filter(r=>r.hit5).map(r=>{const q=registry.cases.find(q=>q.id===r.id);return{id:r.id,query:q.query,scope:r.scope,label:r.label,judgments:q.judgments};}),null,2)+'\n');
console.log(JSON.stringify(result));

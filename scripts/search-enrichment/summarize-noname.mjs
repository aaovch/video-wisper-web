import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const comparisons=['noname','noname-new'].map(tag=>{
 const b=read(`.codex/search-pilot/${tag}-holdout-before.json`),a=read(`.codex/search-pilot/${tag}-holdout-revised.json`);
 if(b.registryHash!==a.registryHash||b.rows.length!==a.rows.length)throw Error('Unpaired registry');
 const losses=[],sourceLosses=[],multi=[],negatives=[];
 a.rows.forEach((r,i)=>{
  const p=b.rows[i];if(p.id!==r.id||p.scope!==r.scope||p.label!==r.label)throw Error('Unpaired scenario');
  if(p.hit5&&!r.hit5)losses.push({id:r.id,scope:r.scope});
  if(r.kind==='multi'){
   multi.push({id:r.id,scope:r.scope,before:p.sourceCoverage5,after:r.sourceCoverage5});
   if(r.sourceCoverage5<p.sourceCoverage5)sourceLosses.push({id:r.id,scope:r.scope});
  }
  if(r.kind==='unsupported')negatives.push({id:r.id,scope:r.scope,beforeReturned:p.returned,afterReturned:r.returned,matchKind:r.matchKind});
 });
 return {tag,registryHash:a.registryHash,beforeIndexHash:b.indexHash,afterIndexHash:a.indexHash,scenarios:a.rows.length,
  groups:['report','collection','archive'].map(scope=>{
   const old=b.rows.filter(r=>r.kind==='single'&&r.scope===scope),now=a.rows.filter(r=>r.kind==='single'&&r.scope===scope);
   return {scope,n:now.length,beforeHit5:old.filter(r=>r.hit5).length,afterHit5:now.filter(r=>r.hit5).length};
  }),losses,sourceLosses,multi,negatives,coreGzipBefore:b.coreGzipBytes,coreGzipAfter:a.coreGzipBytes};
});
const result={date:'2026-09-08',newReports:10,newCards:200,totalFencingReports:29,totalFencingCards:434,comparisons,
 gates:{noIndividualHit5Loss:comparisons.every(c=>!c.losses.length),noSourceCoverageLoss:comparisons.every(c=>!c.sourceLosses.length)},
 caveats:['Same-author source-aware questions; one card clarified after observing a baseline loss. No judgments were changed.',
 'noname-15 is an overstrict multi-source diagnostic: chapter 14 already compares both distances; chapter 15 elaborates the near case. Do not count failure to show both as proven missing answer.',
 'Unsupported personal-history questions may retrieve related material; nonempty results do not supply the missing personal facts.',
 'Only the sword and sabre sections of NoName are complete; the other sections are not included.']};
if(!Object.values(result.gates).every(Boolean))throw Error('Regression');
writeFileSync('docs/search-quality/noname-rollout.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

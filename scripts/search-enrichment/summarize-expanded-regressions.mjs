import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const baseline=read('.codex/search-pilot/expanded-holdout-baseline.json');
function compare(beforePath,afterPath,experimental=false){
 const b=read(beforePath),a=read(afterPath);
 if((b.fixtureHash??b.registryHash)!==(a.fixtureHash??a.registryHash)||b.rows.length!==a.rows.length)throw Error('Unpaired registry');
 if(!experimental&&b.indexHash!==baseline.indexHash)throw Error('Historical baseline index changed; run a new baseline');
 const losses=[],sourceLosses=[],negativeRegressions=[];
 a.rows.forEach((r,i)=>{
  const prev=b.rows[i];
  for(const key of ['id','area','scope','label','collection'])if(r[key]!==prev[key])throw Error(`Unpaired ${key}`);
  if(prev.hit5&&!r.hit5)losses.push({id:r.id,scope:r.scope??r.area,label:r.label??r.collection,before:prev.rank,after:r.rank});
  if(r.kind==='multi'&&r.sourceCoverage5<prev.sourceCoverage5)sourceLosses.push(r.id);
  if(r.negative&&!prev.returned&&r.returned)negativeRegressions.push(r.id);
 });
 return {beforePath,afterPath,experimental,scenarios:a.rows.length,beforeIndexHash:b.indexHash,afterIndexHash:a.indexHash,losses,sourceLosses,negativeRegressions,
 beforeHit5:b.rows.filter(r=>r.hit5).length,afterHit5:a.rows.filter(r=>r.hit5).length};
}
const comparisons=[
 compare('.codex/search-fencing/ranking-numeric.json','.codex/search-fencing/ranking-expanded-regression.json'),
 compare('.codex/search-fencing/ranking-numeric-holdout.json','.codex/search-fencing/ranking-expanded-holdout.json'),
 ...['development','holdout'].map(s=>compare(`.codex/search-pilot/${s}-baseline.json`,`.codex/search-pilot/expanded-regression-${s}-cards.json`)),
 ...['development','holdout'].map(s=>compare(`.codex/search-pilot/${s}-cards.json`,`.codex/search-pilot/expanded-regression-${s}-cards.json`,true))
];
const accepted=comparisons.filter(c=>!c.experimental);
const result={revision:'expanded-113',baselineIndexHash:baseline.indexHash,comparisons,
 gates:{noBaselineHit5Loss:accepted.every(c=>!c.losses.length),noBaselineSourceCoverageLoss:accepted.every(c=>!c.sourceLosses.length),noNegativeRegression:accepted.every(c=>!c.negativeRegressions.length)},
 caveat:'Historical results are reused only after matching the baseline index hash and unchanged search runtime. Old 24-card experiment is shown separately and was never enabled.'};
writeFileSync('docs/search-quality/pilot-expanded-regressions.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

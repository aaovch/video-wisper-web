import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {evaluateReviewedCase} from './relevance-review.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const version=process.env.RELEVANCE_VERSION??'v1';
if(!['v1','v2'].includes(version))throw Error('Invalid review version');
const reviewPath=`scripts/search-enrichment/relevance-reviewed-${version}.json`;
const review=read(reviewPath);
const capturePath=version==='v1'?'.codex/relevance-review-hits.json':`.codex/relevance-review-hits-${version}.json`,capture=read(capturePath);
if(capture.registryHash!==review.protocol.originalRegistrySha256)throw Error('Unpaired registry');
const reviewHash=createHash('sha256').update(readFileSync(reviewPath)).digest('hex');
if(reviewHash!==readFileSync(reviewPath.replace('.json','.sha256'),'utf8').trim())throw Error('Review changed');
if(capture.reviewSha256&&capture.reviewSha256!==reviewHash)throw Error('Unpaired review');
const rows=capture.rows.map(r=>({scope:r.scope,...evaluateReviewedCase(review.cases.find(q=>q.id===r.id),r.hits)}));
const result={protocol:'Same retrieved hits, different documented assessment. This is NOT a search-quality gain or algorithm comparison. Unjudged hits are unknown, not irrelevant.',
 indexHash:capture.indexHash,reviewSha256:createHash('sha256').update(readFileSync(reviewPath)).digest('hex'),
 captureSha256:createHash('sha256').update(readFileSync(capturePath)).digest('hex'),rows};
writeFileSync(`docs/search-quality/relevance-review-${version}.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(rows.map(({id,scope,originalChapterCoverage5,reviewedFacetCoverage5,missing})=>({id,scope,originalChapterCoverage5,reviewedFacetCoverage5,missing})),null,2));

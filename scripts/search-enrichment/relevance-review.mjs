export function matchesReviewedSource(hit,judgment){
 if(hit.reportSlug!==judgment.reportSlug)return false;
 const s=judgment.selector;
 if(s.chapterIndex!==undefined)return hit.chapterIndex===s.chapterIndex;
 return hit.kind===s.kind&&hit.title===s.title&&(s.start===undefined||hit.start===s.start);
}
// Mirror the currently displayed grouping; no production ranking is changed.
export function visibleReviewHits(hits){
 const seen=new Set();return hits.filter(h=>{
  const key=h.chapterIndex!=null?`${h.reportSlug}:chapter:${h.chapterIndex}`:h.kind==='overview'?`${h.reportSlug}:overview`:h.kind==='report'?`${h.reportSlug}:report`:`${h.reportSlug}:${h.zone}:${h.title}`;
  if(seen.has(key))return false;seen.add(key);return true;
 }).slice(0,5);
}
export function evaluateReviewedCase(q,hits){
 const visible=visibleReviewHits(hits),covered=new Set();
 const judgments=visible.map(h=>{
  const matched=q.judgments.filter(j=>matchesReviewedSource(h,j));
  for(const j of matched)if(j.grade===3)for(const facet of j.supports)covered.add(facet);
  return {reportSlug:h.reportSlug,chapterIndex:h.chapterIndex,title:h.title,start:h.start,
   grade:matched.length?Math.max(...matched.map(j=>j.grade)):null};
 });
 const expected=q.originalJudgments.filter(j=>j.grade===3);
 const originalFound=expected.filter(j=>visible.some(h=>h.reportSlug===j.reportSlug&&h.chapterIndex===j.chapterIndex)).length;
 return {id:q.id,originalChapterCoverage5:originalFound/expected.length,
  reviewedFacetCoverage5:covered.size/q.facets.length,complete:covered.size===q.facets.length,
  covered:[...covered],missing:q.facets.filter(f=>!covered.has(f.id)).map(f=>f.id),
  unjudged:judgments.filter(j=>j.grade===null).length,judgments};
}

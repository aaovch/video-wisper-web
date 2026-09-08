import type {SearchHit,SearchMatchKind} from './search-types';

/** Prefer source passages to report overviews only in related-results fallback.
 * Keep score order within both groups and retain all material/overview links.
 */
export function orderSearchPassages(hits:SearchHit[],kind:SearchMatchKind):SearchHit[]{
 if(kind!=='semantic')return hits;
 return [...hits.filter(h=>h.chapterIndex!=null),...hits.filter(h=>h.chapterIndex==null)];
}

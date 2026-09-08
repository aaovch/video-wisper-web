import graph from './data/search-source-links.json';
import type {SearchHit,SearchScope} from './search-types';
export function relatedSources(hit:SearchHit,scope:SearchScope|undefined){
 if(hit.chapterIndex==null||!scope||scope.zones?.length&&!scope.zones.includes('chapters'))return [];
 const allowed=new Set(scope.kind==='report'?[scope.reportSlug]:scope.reportSlugs);
 if(!allowed.has(hit.reportSlug))return [];
 return graph.links.flatMap(link=>{
  if(!link.sources.some(s=>s.reportSlug===hit.reportSlug&&s.chapterIndex===hit.chapterIndex))return [];
  return link.sources.filter(s=>!(s.reportSlug===hit.reportSlug&&s.chapterIndex===hit.chapterIndex)&&allowed.has(s.reportSlug)).map(source=>({id:link.id,explanation:link.explanation,...source,href:`/reports/${source.reportSlug}/?t=${Math.ceil(source.start)}#ch-${source.chapterIndex+1}`}));
 });
}

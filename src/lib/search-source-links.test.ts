import {expect,it} from 'vitest';
import graph from './data/search-source-links.json';
import {relatedSources} from './search-source-links';
import type {SearchHit} from './search-types';
it('keeps links within actual scope, visibility and selected source zones',()=>{
 const [a,b]=graph.links[2].sources;
 const hit={reportSlug:a.reportSlug,chapterIndex:a.chapterIndex} as SearchHit;
 expect(relatedSources(hit,undefined)).toEqual([]);
 expect(relatedSources(hit,{kind:'report',label:'report',reportSlug:a.reportSlug})).toEqual([]);
 expect(relatedSources(hit,{kind:'archive',label:'locked',reportSlugs:[a.reportSlug]})).toEqual([]);
 const scope={kind:'archive' as const,label:'unlocked',reportSlugs:[a.reportSlug,b.reportSlug]};
 expect(relatedSources(hit,scope)).toHaveLength(1);
 expect(relatedSources(hit,{...scope,zones:['transcript']})).toEqual([]);
 expect(relatedSources({...hit,chapterIndex:undefined},scope)).toEqual([]);
 expect(relatedSources(hit,scope)[0]).toMatchObject({reportSlug:b.reportSlug,chapterIndex:b.chapterIndex});
 const [left,right]=graph.links[0].sources;
 expect(relatedSources({reportSlug:left.reportSlug,chapterIndex:left.chapterIndex} as SearchHit,{kind:'report',label:'report',reportSlug:left.reportSlug})[0].chapterIndex).toBe(right.chapterIndex);
});

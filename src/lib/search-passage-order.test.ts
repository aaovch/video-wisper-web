import {expect,it} from 'vitest';
import {orderSearchPassages} from './search-passage-order';
import type {SearchHit} from './search-types';
it('preserves exact, prefix and correction order and every original result',()=>{
 const hits=[{kind:'material',title:'exercise',start:23},{kind:'chapter',chapterIndex:0},{kind:'overview'},{kind:'transcript',chapterIndex:2},{kind:'material',title:'exercise',start:48}] as SearchHit[];
 for(const kind of ['exact','prefix','correction'] as const)expect(orderSearchPassages(hits,kind)).toBe(hits);
 const ordered=orderSearchPassages(hits,'semantic');
 expect(ordered).toEqual([hits[1],hits[3],hits[0],hits[2],hits[4]]);
 expect(new Set(ordered)).toEqual(new Set(hits));
 expect(hits[0].kind).toBe('material');
});

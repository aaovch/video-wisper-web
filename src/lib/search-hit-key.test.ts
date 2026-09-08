import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {searchHitKey} from './search-hit-key';
import type {SearchHit} from './search-types';

const hit=(patch:Partial<SearchHit>={}):SearchHit=>({kind:'material',zone:'additional',reportSlug:'mech-i-bakler-mikrotsikl-1-osnovy',reportTitle:'Меч и баклер',title:'Упражнения',snippet:'',matchKind:'exact',href:'/reports/mech-i-bakler-mikrotsikl-1-osnovy/#additional-title',score:1,...patch});
it('keeps distinct timed exercises even when their section title is identical',()=>{
 const a=hit({start:528.89}),b=hit({start:4822.24});
 expect(searchHitKey(a)).not.toBe(searchHitKey(b));
 expect(new Set([a,b,{...a,score:2,snippet:'another match'}].map(searchHitKey)).size).toBe(2);
 expect(searchHitKey(hit({start:0}))).not.toBe(searchHitKey(hit()));
});
it('continues collapsing passages in the same chapter, without merging other reports',()=>{
 const a=hit({kind:'chapter',zone:'chapters',chapterIndex:3,start:100});
 expect(searchHitKey(a)).toBe(searchHitKey({...a,kind:'transcript',zone:'transcript',start:130}));
 expect(searchHitKey(a)).not.toBe(searchHitKey({...a,reportSlug:'other'}));
});
it('preserves every timed item from the real sword and buckler report',()=>{
 const report=JSON.parse(readFileSync('src/lib/data/reports/mech-i-bakler-mikrotsikl-1-osnovy.json','utf8'));
 const items=report.seminar_exercises.flatMap((s:any)=>s.items??[]).filter((i:any)=>Number.isFinite(i.start));
 expect(items.length).toBeGreaterThan(3);
 const hits=items.map((i:any)=>hit({start:i.start}));
 expect(new Set(hits.map(searchHitKey)).size).toBe(new Set(items.map((i:any)=>i.start)).size);
});

import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import graph from '../../src/lib/data/search-source-links.json';
import {validateSourceLinks} from './source-links.mjs';
const read=(slug:string)=>JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
it('rejects changed sources, fabricated evidence and stale destinations',()=>{
 expect(validateSourceLinks(graph,read)).toBe(graph);
 const changed=(slug:string)=>{const r=read(slug);r.chapters[4].summary+=' changed';return r;};
 expect(()=>validateSourceLinks(graph,changed)).toThrow('stale');
 const bad=structuredClone(graph);bad.links[0].sources[0].evidence='This evidence was invented for a test';
 expect(()=>validateSourceLinks(bad,read)).toThrow('ungrounded');
 const time=structuredClone(graph);time.links[0].sources[0].start++;
 expect(()=>validateSourceLinks(time,read)).toThrow('stale label/time');
 const duplicate=structuredClone(graph);duplicate.links[0].sources[1]=duplicate.links[0].sources[0];
 expect(()=>validateSourceLinks(duplicate,read)).toThrow('duplicate source');
});

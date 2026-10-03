import {describe,it,expect} from 'vitest';
// @ts-expect-error Node-only migration script.
import {projectLegacy,readLegacyCount} from './export-legacy-analytics.mjs';

describe('historical counter migration',()=>{
	it('reads without incrementing and preserves measured zeros',async()=>{
		let called: URL | undefined;
		const result=await readLegacyCount('/video-wisper-web/reports/a',async(url:URL)=>{called=url;return new Response('{"views":0}');});
		expect(result).toBe(0);
		expect(called?.pathname).toBe('/api/v1/views');
		expect(called?.searchParams.get('path')).toBe('/video-wisper-web/reports/a');
	});
	it('never substitutes zero for a failed counter',async()=>{
		await expect(readLegacyCount('/a',async()=>new Response('',{status:503}))).rejects.toThrow('503');
		await expect(readLegacyCount('/a',async()=>new Response('{"views":-1}'))).rejects.toThrow('Invalid');
	});
	it('preserves full private backup but publishes only public counters',()=>{
		const full={source:'Page Views API',capturedAt:'2026-10-03T09:00:00Z',capturedFrom:'2026-10-03T08:58:00Z',siteVisits:1237,rows:[{slug:'a',visits:7},{slug:'secret',visits:99}]};
		expect(projectLegacy(full,['a']).rows).toEqual([{slug:'a',visits:7}]);
		expect(full.rows).toHaveLength(2);
	});
});

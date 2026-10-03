import { describe, expect, it } from 'vitest';
// @ts-expect-error Node-only exporter is intentionally plain JavaScript.
import { createSnapshot, publicSlugs, readHits, readTimezone } from './export-analytics.mjs';

describe('public GoatCounter export', () => {
	it('uses the required JSON header and understands the hosted country-prefixed timezone', async()=>{
		let headers: Record<string,string> | undefined;
		const timezone=await readTimezone('https://test.goatcounter.com','test-only',async(_url:string,options:{headers:Record<string,string>})=>{headers=options.headers; return new Response('{"user":{"settings":{"timezone":"KZ.Asia/Qyzylorda"}}}');});
		expect(headers?.['Content-Type']).toBe('application/json');
		expect(timezone).toBe('Asia/Qyzylorda');
	});
	it('does not publish isolated or hidden materials, or duplicate collection membership', () => {
		expect(publicSlugs([{slug:'a'},{slug:'b'},{slug:'c'}], [
			{items:['a']},{items:['a']},{items:['b'],isolated:true},{items:['c'],catalogHidden:true}
		])).toEqual(['a']);
	});
	it('projects only known page counts, never event payloads or visitor details', () => {
		const options = {base:'/site',startDate:'2026-10-03',endDate:'2026-10-03',timezone:'Asia/Qyzylorda',generatedAt:'2026-10-03T12:00:00Z'};
		const snapshot = createSnapshot([
			{path:'/site/reports/a',count:5,stats:[{day:'2026-10-03',daily:5,hourly:[5]}],title:'private',referrer:'private'},
			{path:'/event',count:100,event:true,stats:[]},
			{path:'/site/reports/secret',count:2,stats:[]}
		],['a','b'],options);
		expect(snapshot.rows).toEqual([{slug:'a',visits:5,daily:[{day:'2026-10-03',visits:5}]},{slug:'b',visits:0,daily:[]}]);
		expect(JSON.stringify(snapshot)).not.toContain('private');
	});
	it('fetches every API page and sends the prior path IDs as exclusions', async () => {
		const calls: URL[] = [];
		const fetcher = async (url: URL) => {
			calls.push(url);
			return new Response(JSON.stringify(calls.length === 1 ? {hits:[{path_id:1},{path_id:2}],more:true} : {hits:[{path_id:3}],more:false}));
		};
		expect(await readHits('https://test.goatcounter.com','test-only','start','end',fetcher)).toHaveLength(3);
		expect(calls[1].searchParams.getAll('exclude_paths')).toEqual(['1,2']);
	});
	it('rejects duplicated canonical paths and inconsistent totals', () => {
		const options={base:'/site',startDate:'2026-10-03',endDate:'2026-10-03',timezone:'Asia/Qyzylorda',generatedAt:'2026-10-03T12:00:00Z'};
		expect(()=>createSnapshot([{path:'/site/reports/a',count:0,stats:[]},{path:'/site/reports/a/',count:0,stats:[]}],['a'],options)).toThrow('Duplicate');
		expect(()=>createSnapshot([{path:'/site/reports/a',count:2,stats:[{day:'2026-10-03',daily:1}]}],['a'],options)).toThrow('Inconsistent');
	});
	it('fails closed on partial responses and non-advancing pagination', async () => {
		await expect(readHits('https://test.goatcounter.com','test-only','start','end',async()=>new Response('error',{status:403}))).rejects.toThrow('HTTP 403');
		await expect(readHits('https://test.goatcounter.com','test-only','start','end',async()=>new Response(JSON.stringify({hits:[],more:true})))).rejects.toThrow('did not advance');
	});
	it('accepts a new account with no hits as measured zeros', async () => {
		expect(await readHits('https://test.goatcounter.com','test-only','start','end',async()=>new Response(JSON.stringify({hits:null,more:false})))).toEqual([]);
	});
});

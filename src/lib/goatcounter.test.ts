import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true, dev: false }));

describe('GoatCounter navigation tracking', () => {
	let script: { onload: () => void; onerror: () => void; dataset: Record<string,string>; remove: ReturnType<typeof vi.fn> };
	const count = vi.fn();
	const originalData = (data: unknown) => ({ ...data as object, q: '?access=secret' });
	beforeEach(() => {
		vi.resetModules(); count.mockReset(); vi.useFakeTimers();
		script = { onload: () => {}, onerror: () => {}, dataset: {}, remove: vi.fn() };
		vi.stubGlobal('document', { referrer:'https://search.example/?private=yes', createElement: () => script, head:{ append:vi.fn() } });
		vi.stubGlobal('window', { goatcounter:{ count, filter:()=>false, get_data:originalData } });
	});
	afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
	it('ignores local previews and other projects', async () => {
		const { trackGoatcounter } = await import('./goatcounter');
		await trackGoatcounter(new URL('http://localhost:4174/video-wisper-web/'),'Preview');
		await trackGoatcounter(new URL('https://aaovch.github.io/other-project/'),'Other');
		expect(document.head.append).not.toHaveBeenCalled();
	});
	it('tracks routes once, ignores hash/query changes and removes query payloads', async () => {
		const { trackGoatcounter } = await import('./goatcounter');
		const first = trackGoatcounter(new URL('https://aaovch.github.io/video-wisper-web/reports/a/?access=secret'),'Report A');
		script.onload(); await first;
		await trackGoatcounter(new URL('https://aaovch.github.io/video-wisper-web/reports/a/#chapter-1'),'Report A');
		await trackGoatcounter(new URL('https://aaovch.github.io/video-wisper-web/reports/b/'),'Report B');
		await trackGoatcounter(new URL('https://aaovch.github.io/video-wisper-web/reports/a/'),'Report A');
		expect(count).toHaveBeenCalledTimes(3);
		expect(count.mock.calls[0][0]).toEqual({path:'/video-wisper-web/reports/a',title:'Report A',referrer:'https://search.example'});
		expect((window as unknown as {goatcounter:{get_data:(value:unknown)=>{q:string}}}).goatcounter.get_data({} as unknown)).toHaveProperty('q','');
		expect(JSON.parse(script.dataset.goatcounterSettings)).toEqual({no_onload:true,no_events:true});
	});
	it('recovers from a blocked script without breaking navigation', async () => {
		const { trackGoatcounter } = await import('./goatcounter');
		const url = new URL('https://aaovch.github.io/video-wisper-web/');
		const first = trackGoatcounter(url,'Catalog'); script.onerror(); await first;
		const retry = trackGoatcounter(url,'Catalog'); script.onload(); await retry;
		expect(count).toHaveBeenCalledTimes(1);
	});
});

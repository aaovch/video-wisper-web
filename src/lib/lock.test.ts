import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccessTarget } from './data/collections';

const target: AccessTarget = { id:'report:recording', kind:'pass', collectionSlug:'course', title:'Recording', password:'server-managed-credential' };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe('access key navigation', () => {
	it('opens the admin panel when the server confirms an owner login', async () => {
		vi.stubEnv('VITE_HEMA_SERVER','1');
		const assign = vi.fn();
		vi.stubGlobal('location',{href:'https://example.test/',assign});
		vi.stubGlobal('fetch',vi.fn(async () => new Response(null,{status:204,headers:{'X-Archive-Admin':'/admin/'}})));
		const { lock } = await import('./lock.svelte');
		expect(await lock.tryUnlock([target],'owner-key','/collections/course/')).toBe(true);
		expect(assign).toHaveBeenCalledWith('/admin/');
	});
	it('accepts the owner key through a collection form even though it is not a recording target', async () => {
		vi.stubEnv('VITE_HEMA_SERVER','1');
		const assign = vi.fn();
		vi.stubGlobal('location',{href:'https://example.test/',assign});
		vi.stubGlobal('fetch',vi.fn(async () => new Response(null,{status:204,headers:{'X-Archive-Target':'archive%3Aowner'}})));
		const { lock } = await import('./lock.svelte');
		expect(await lock.tryUnlock([target],'owner-key',matched => matched ? '/reports/recording/' : '/collections/course/')).toBe(true);
		expect(assign).toHaveBeenCalledWith('/collections/course/');
	});
	it('takes a video key straight to its recording and keeps a rejected key on the current page', async () => {
		vi.stubEnv('VITE_HEMA_SERVER','1');
		const assign = vi.fn();
		vi.stubGlobal('location',{href:'https://example.test/',assign});
		const fetcher = vi.fn().mockResolvedValueOnce(new Response(null,{status:403}))
			.mockResolvedValueOnce(new Response(null,{status:204,headers:{'X-Archive-Target':encodeURIComponent(target.id)}}));
		vi.stubGlobal('fetch',fetcher);
		const { lock } = await import('./lock.svelte');
		expect(await lock.tryUnlock([target],'wrong-key')).toBe(false);
		expect(assign).not.toHaveBeenCalled();
		expect(await lock.tryUnlock([target],'video-key',matched => matched?.id === target.id ? '/reports/recording/' : '/')).toBe(true);
		expect(assign).toHaveBeenCalledWith('/reports/recording/');
	});
	it('never treats a server credential placeholder as a usable static password', async () => {
		vi.stubEnv('VITE_HEMA_SERVER','');
		vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn(),removeItem:vi.fn()});
		const { lock } = await import('./lock.svelte');
		expect(await lock.tryUnlock([target],'server-managed-credential')).toBe(false);
		expect(lock.unlocked).toEqual([]);
	});
});

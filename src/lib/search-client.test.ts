import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchRequest, SearchReply } from './search-worker-protocol';

const fallback = vi.hoisted(() => ({ configureSearchBase: vi.fn(), searchScoped: vi.fn(), preloadSearchIndex: vi.fn(), whenSearchComplete: vi.fn() }));
vi.mock('./search-core', () => fallback);
vi.mock('$app/paths', () => ({ base: '/hema' }));
vi.mock('./data/report-meta', () => ({ getAllReportSummaries: () => [
	{ slug: 'fixture', title: 'Сабля', tags: ['Сабля'], overview_theses: ['not sent to the worker'] }
] }));

class FakeWorker {
	static instances: FakeWorker[] = [];
	onmessage?: (event: { data: SearchReply }) => void;
	onerror?: () => void;
	onmessageerror?: () => void;
	requests: SearchRequest[] = [];
	terminate = vi.fn();
	constructor() { FakeWorker.instances.push(this); }
	postMessage(request: SearchRequest) { this.requests.push(request); }
	reply(reply: SearchReply) { this.onmessage?.({ data: reply }); }
}

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	FakeWorker.instances = [];
	vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('search worker bridge', () => {
	it('supplies only session title/tag metadata on the first server request', async () => {
		vi.stubEnv('VITE_HEMA_SERVER', '1');
		const client = await import('./search-client');
		client.preloadSearchIndex();
		const worker = FakeWorker.instances[0];
		expect(worker.requests[0].reports).toEqual([{ slug: 'fixture', title: 'Сабля', tags: ['Сабля'] }]);
		worker.reply({ id: worker.requests[0].id, ok: true });
		const complete = client.whenSearchComplete();
		expect(worker.requests[1].reports).toBeUndefined();
		worker.reply({ id: worker.requests[1].id, ok: true });
		await complete;
	});
	it('correlates concurrent replies and reuses the worker across searches', async () => {
		const client = await import('./search-client');
		const first = client.searchScoped('меч', [], 5);
		const second = client.searchScoped('сабля', [], 10);
		const worker = FakeWorker.instances[0];
		expect(FakeWorker.instances).toHaveLength(1);
		expect(worker.requests.map(request => request.method)).toEqual(['search', 'search']);
		expect(worker.requests.every(request => request.base === '/hema')).toBe(true);
		const result = { hits: [], query: 'сабля' } as any;
		worker.reply({ id: worker.requests[1].id, ok: true, result });
		worker.reply({ id: worker.requests[0].id, ok: false, error: 'HTTP 503' });
		await expect(second).resolves.toEqual(result);
		await expect(first).rejects.toThrow('HTTP 503');
		expect(fallback.searchScoped).not.toHaveBeenCalled();
	});

	it('falls back for all in-flight calls if the worker fails to start', async () => {
		const client = await import('./search-client');
		fallback.searchScoped.mockResolvedValue({ hits: [] });
		const first = client.searchScoped('меч', [], 5);
		const second = client.searchScoped('сабля', [], 10);
		FakeWorker.instances[0].onerror?.();
		await Promise.all([first, second]);
		expect(fallback.searchScoped).toHaveBeenCalledWith('меч', [], 5, false);
		expect(fallback.searchScoped).toHaveBeenCalledWith('сабля', [], 10, false);
		expect(fallback.configureSearchBase).toHaveBeenCalledWith('/hema');
		expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
		await client.searchScoped('рапира', []);
		expect(FakeWorker.instances).toHaveLength(1);
	});

	it('preserves the total and forwards full-list requests through the worker', async () => {
		const client = await import('./search-client');
		const result = client.searchScoped('меч', [], 30, true);
		const worker = FakeWorker.instances[0];
		expect(worker.requests[0]).toMatchObject({ method: 'search', limit: 30, includeAll: true });
		const response = { hits: [], query: 'меч', total: 37, hasMore: false } as any;
		worker.reply({ id: worker.requests[0].id, ok: true, result: response });
		await expect(result).resolves.toEqual(response);
	});

	it('forwards full-list requests when workers are unavailable', async () => {
		vi.stubGlobal('Worker', undefined);
		const client = await import('./search-client');
		await client.searchScoped('меч', [], 30, true);
		expect(fallback.searchScoped).toHaveBeenCalledWith('меч', [], 30, true);
	});

	it('works without Worker support', async () => {
		vi.stubGlobal('Worker', undefined);
		const client = await import('./search-client');
		await client.searchScoped('меч', []);
		await client.whenSearchComplete();
		expect(fallback.searchScoped).toHaveBeenCalledOnce();
		expect(fallback.whenSearchComplete).toHaveBeenCalledOnce();
	});

	it('warms only once and waits for transcript completion over the same channel', async () => {
		const client = await import('./search-client');
		client.preloadSearchIndex();
		client.preloadSearchIndex();
		const complete = client.whenSearchComplete();
		const worker = FakeWorker.instances[0];
		expect(worker.requests.map(request => request.method)).toEqual(['preload', 'complete']);
		for (const request of worker.requests) worker.reply({ id: request.id, ok: true });
		await complete;
		expect(fallback.whenSearchComplete).not.toHaveBeenCalled();
	});
});

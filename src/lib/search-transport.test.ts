import { createHash } from 'node:crypto';
import MiniSearch from 'minisearch';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { packSearchIndex } from './search-index-codec.js';
import { loadSearchAsset, resetSearchTransport } from './search-transport';

const origin = 'https://archive.example';
let stored: Map<string, Response>;
let files: Map<string, string>;
let descriptor: { file: string; bytes: number };
let fetchMock: ReturnType<typeof vi.fn>;
function fixture(title = 'Клинок') {
	const mini = new MiniSearch({ fields: ['title'], storeFields: ['title'] });
	mini.add({ id: 1, title });
	const body = JSON.stringify(packSearchIndex(JSON.parse(JSON.stringify(mini))));
	const hash = createHash('sha256').update(body).digest('hex').slice(0, 20);
	descriptor = { file: `packed-core-${hash}.json`, bytes: Buffer.byteLength(body) };
	files.set(`/hema/search/${descriptor.file}`, body);
	files.set('/hema/search/manifest.json', JSON.stringify({ transport: { version: 1, assets: {
		core: descriptor,
		transcripts: { file: `packed-transcripts-${hash}.json`, bytes: 1 },
		titles: { file: `packed-titles-${hash}.json`, bytes: 1 }
	} } }));
}
beforeEach(() => {
	resetSearchTransport();
	stored = new Map(); files = new Map(); fixture();
	fetchMock = vi.fn(async (url: string) => new Response(files.get(url) ?? '', { status: files.has(url) ? 200 : 404 }));
	vi.stubGlobal('fetch', fetchMock);
	vi.stubGlobal('caches', { open: async () => ({
		match: async (url: string) => stored.get(url)?.clone(),
		put: async (url: string, response: Response) => { stored.set(url, response.clone()); },
		delete: async (input: string | Request) => stored.delete(typeof input === 'string' ? input : new URL(input.url).pathname),
		keys: async () => [...stored.keys()].map(url => new Request(origin + url))
	}) });
});
afterEach(() => { resetSearchTransport(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('downloads a content-addressed shard once and reuses it in a new search session', async () => {
	const first = await loadSearchAsset('/hema', 'core');
	resetSearchTransport();
	expect(await loadSearchAsset('/hema', 'core')).toEqual(first);
	expect(fetchMock.mock.calls.filter(([url]) => url.includes('packed-core'))).toHaveLength(1);
	expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('manifest.json'))).toHaveLength(2);
});

it('fetches a changed revision and prunes the previous revision only', async () => {
	const first = await loadSearchAsset('/hema', 'core');
	fixture('Новая глава'); resetSearchTransport();
	const next = await loadSearchAsset('/hema', 'core');
	expect(next).not.toEqual(first);
	expect(stored.size).toBe(1);
	expect([...stored.keys()][0]).toContain(descriptor.file);
});

it('evicts a corrupt cached response and retries from the network', async () => {
	await loadSearchAsset('/hema', 'core');
	stored.set(`/hema/search/${descriptor.file}`, new Response('{}'));
	expect(await loadSearchAsset('/hema', 'core')).not.toBeNull();
	expect(fetchMock.mock.calls.filter(([url]) => url.includes('packed-core'))).toHaveLength(2);
});

it('falls back for missing or corrupt compact assets without caching them', async () => {
	files.set(`/hema/search/${descriptor.file}`, '{}');
	expect(await loadSearchAsset('/hema', 'core')).toBeNull();
	expect(stored.size).toBe(0);
	files.delete(`/hema/search/${descriptor.file}`);
	expect(await loadSearchAsset('/hema', 'core')).toBeNull();
});

it('still loads with blocked persistent storage', async () => {
	vi.stubGlobal('caches', { open: async () => { throw new Error('denied'); } });
	expect(await loadSearchAsset('/hema', 'core')).not.toBeNull();
});

it('does not fetch public artifacts or open a persistent cache on the authenticated server', async () => {
	vi.stubEnv('VITE_HEMA_SERVER', '1');
	const open = vi.fn(); vi.stubGlobal('caches', { open });
	expect(await loadSearchAsset('/hema', 'core')).toBeNull();
	expect(fetchMock).not.toHaveBeenCalled();
	expect(open).not.toHaveBeenCalled();
});

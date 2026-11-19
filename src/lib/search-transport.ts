import { unpackSearchIndex, SEARCH_WIRE_VERSION } from './search-index-codec.js';

type AssetKind = 'core' | 'transcripts' | 'titles';
interface Asset { file: string; bytes: number }
interface Transport { version: number; assets: Record<AssetKind, Asset> }
let manifestPromise: Promise<Transport | null> | undefined;

export function resetSearchTransport(): void { manifestPromise = undefined; }

async function manifest(base: string): Promise<Transport | null> {
	// The authenticated server builds its own per-session indexes. Never persist
	// these or substitute the public static artifacts for an authorized scope.
	if (import.meta.env.VITE_HEMA_SERVER) return null;
	return manifestPromise ??= (async () => {
		try {
			const response = await fetch(`${base}/search/manifest.json`, { cache: 'no-cache' });
			if (!response.ok) return null;
			const transport = (await response.json()).transport as Transport | undefined;
			if (transport?.version !== SEARCH_WIRE_VERSION) return null;
			for (const kind of ['core', 'transcripts', 'titles'] as const) {
				if (!new RegExp(`^packed-${kind}-[a-f0-9]{20}\\.json$`).test(transport.assets?.[kind]?.file)) return null;
				if (!Number.isSafeInteger(transport.assets[kind].bytes) || transport.assets[kind].bytes <= 0) return null;
			}
			return transport;
		} catch { return null; }
	})();
}

async function openCache(base: string): Promise<Cache | undefined> {
	try {
		if (typeof caches !== 'undefined') return await caches.open(`video-wisper-search-wire-v1:${base}`);
	} catch { /* Private browsing, denied storage or quota: network still works. */ }
}

/** null selects the legacy endpoint, including during a rolling deployment. */
export async function loadSearchAsset(base: string, kind: AssetKind): Promise<Record<string, any> | null> {
	const transport = await manifest(base);
	if (!transport) return null;
	const descriptor = transport.assets[kind];
	const url = `${base}/search/${descriptor.file}`;
	const cache = await openCache(base);
	const decode = async (response: Response): Promise<Record<string, any>> => {
		if (!response.ok) throw new Error(`Search asset HTTP ${response.status}`);
		const text = await response.text();
		const bytes = new TextEncoder().encode(text);
		if (bytes.byteLength !== descriptor.bytes) throw new Error('Search asset size mismatch');
		if (globalThis.crypto?.subtle) {
			const digest = await crypto.subtle.digest('SHA-256', bytes);
			const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 20);
			if (descriptor.file !== `packed-${kind}-${hash}.json`) throw new Error('Search asset hash mismatch');
		}
		const payload: unknown = JSON.parse(text);
		if (kind !== 'titles') return unpackSearchIndex(payload);
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)
			|| !Object.values(payload).every(value => Array.isArray(value) && value.every(title => typeof title === 'string'))) {
			throw new Error('Invalid chapter titles');
		}
		return payload as Record<string, string[]>;
	};
	try {
		const cached = await cache?.match(url);
		if (cached) {
			try { return await decode(cached); }
			catch { await cache?.delete(url); }
		}
	} catch { /* A storage read failure must not suppress the network request. */ }
	try {
		const response = await fetch(url);
		const copy = response.clone();
		const decoded = await decode(response);
		const control = copy.headers.get('Cache-Control') ?? '';
		if (cache && !/\b(private|no-store)\b/i.test(control)) {
			// Validate before storing. Limit this cache to one revision per shard.
			// Await writes so a short-lived fallback worker cannot lose them.
			try {
				await cache.put(url, copy);
				for (const request of await cache.keys()) {
					const path = new URL(request.url).pathname;
					if (path.endsWith(`/search/${descriptor.file}`)) continue;
					if (new RegExp(`/search/packed-${kind}-[a-f0-9]{20}\\.json$`).test(path)) await cache.delete(request);
				}
			} catch { /* Quota/write failures don't invalidate a valid index. */ }
		}
		return decoded;
	} catch {
		// Missing/corrupt compact asset: fall back to the full original shard.
		return null;
	}
}

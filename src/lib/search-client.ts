import type { SearchResponse, SearchScope } from './search-types';
import { base } from '$app/paths';
import { getAllReportSummaries } from './data/report-meta';
import type { SearchReply, SearchRequest } from './search-worker-protocol';

let worker: Worker | undefined;
let unavailable = false;
let sequence = 0;
let warmed = false;
let metadataSent = false;
let fallbackPromise: Promise<typeof import('./search-core')> | undefined;
const fallbackCore = () => fallbackPromise ??= import('./search-core').then(core => {
	core.configureSearchBase(base);
	return core;
});
const pending = new Map<number, { resolve: (value: SearchResponse | undefined) => void; reject: (error: Error) => void }>();

function getWorker(): Worker | undefined {
	if (unavailable || typeof Worker === 'undefined') return;
	if (worker) return worker;
	try {
		const instance = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
		instance.onmessage = ({ data }: MessageEvent<SearchReply>) => {
			const task = pending.get(data.id);
			if (!task) return;
			pending.delete(data.id);
			if (data.ok) task.resolve(data.result);
			else task.reject(new Error(data.error));
		};
		const fail = () => {
			unavailable = true;
			instance.terminate();
			worker = undefined;
			for (const task of pending.values()) task.reject(new Error('Search worker unavailable'));
			pending.clear();
		};
		instance.onerror = fail;
		instance.onmessageerror = fail;
		worker = instance;
		return instance;
	} catch {
		unavailable = true;
	}
}

function send(request: SearchRequest): Promise<SearchResponse | undefined> {
	const instance = getWorker();
	if (!instance) return Promise.reject(new Error('Search worker unavailable'));
	return new Promise((resolve, reject) => {
		pending.set(request.id, { resolve, reject });
		try {
			if (import.meta.env.VITE_HEMA_SERVER && !metadataSent) {
				request.reports = getAllReportSummaries().map(({ slug, title, tags }) => ({ slug, title, tags }));
				metadataSent = true;
			}
			instance.postMessage(request);
		}
		catch (error) { pending.delete(request.id); reject(error); }
	});
}

export async function searchScoped(query: string, scopes: readonly SearchScope[], limit = 40, includeAll = false): Promise<SearchResponse> {
	if (getWorker()) {
		try {
			return (await send({ id: ++sequence, base, method: 'search', query, scopes, limit, includeAll }))!;
		} catch (error) {
			// A failed fetch remains a visible, retryable search error. Only a
			// worker startup/runtime failure switches to the original engine.
			if (!unavailable) throw error;
		}
	}
	return (await fallbackCore()).searchScoped(query, scopes, limit, includeAll);
}

export async function whenSearchComplete(): Promise<void> {
	if (getWorker()) {
		try { await send({ id: ++sequence, base, method: 'complete' }); return; }
		catch (error) { if (!unavailable) throw error; }
	}
	await (await fallbackCore()).whenSearchComplete();
}

export function preloadSearchIndex(): void {
	if (warmed) return;
	warmed = true;
	if (getWorker()) {
		void send({ id: ++sequence, base, method: 'preload' }).catch(() => { warmed = false; });
	} else {
		void fallbackCore().then(core => core.preloadSearchIndex()).catch(() => { warmed = false; fallbackPromise = undefined; });
	}
}

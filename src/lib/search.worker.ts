import { configureSearchBase, configureSearchReportMetadata, preloadSearchIndex, searchScoped, whenSearchComplete } from './search-core';
import type { SearchRequest, SearchReply } from './search-worker-protocol';

// One index per tab, shared across route changes. Parsing and ranking never
// compete with input, scrolling, video controls or Svelte rendering.
self.onmessage = async (event: MessageEvent<SearchRequest>) => {
	const request = event.data;
	configureSearchBase(request.base);
	// The server injects the session catalog into the document, not the worker.
	if (request.reports) configureSearchReportMetadata(request.reports);
	let reply: SearchReply;
	try {
		if (request.method === 'search') {
			const result = await searchScoped(request.query, request.scopes, request.limit, request.includeAll);
			reply = { id: request.id, ok: true, result };
		} else {
			if (request.method === 'preload') preloadSearchIndex();
			else await whenSearchComplete();
			reply = { id: request.id, ok: true };
		}
	} catch (error) {
		reply = { id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
	}
	self.postMessage(reply);
};

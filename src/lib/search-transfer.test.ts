import { readFileSync, writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { searchScoped, resetSearchIndex, whenSearchComplete } from './search-core';
import type { SearchScope, SearchResponse } from './search-types';
import cases from './search-quality-cases.json';
import fencing from '../../scripts/search-enrichment/fencing-cases.json';
import { collections } from './data/collections';

afterEach(() => { resetSearchIndex(); vi.unstubAllGlobals(); });

it.skipIf(process.env.SEARCH_TRANSFER_CHECK !== '1')('returns exactly the same complete responses through legacy and compact transports', async () => {
	const manifest = JSON.parse(readFileSync('static/search/manifest.json', 'utf8'));
	const indexed = new Set<string>(Object.keys(manifest.reportDocuments));
	const files = new Map(['index-core.json', 'index-transcripts.json', 'chapter-titles.json', 'manifest.json',
		...Object.values(manifest.transport.assets).map((asset: any) => asset.file)]
		.map(name => [name, readFileSync(`static/search/${name}`, 'utf8')]));
	const tasks: { query: string; scopes: SearchScope[] }[] = [];
	const archive: SearchScope = { kind: 'archive', label: 'all indexed', reportSlugs: [...indexed] };
	for (const item of [...cases, ...fencing.cases].filter(item => indexed.has(item.reportSlug))) {
		const report: SearchScope = { kind: 'report', label: item.reportSlug, reportSlug: item.reportSlug };
		const collection = collections.find(collection => collection.items.includes(item.reportSlug));
		const scope: SearchScope = { kind: 'collection', label: collection?.slug ?? 'fixture',
			reportSlugs: (collection?.items ?? [item.reportSlug]).filter(slug => indexed.has(slug)) };
		const typo = item.query.replace(/[\p{L}]{6,}/u, word => word.slice(0, 3) + word.slice(4));
		for (const query of new Set([item.query, typo])) {
			for (const target of [report, scope, archive]) tasks.push({ query, scopes: [target] });
		}
		// A fallback chain and transcript-only scope exercise completeness beyond
		// chapter hits and the first successful local result.
		tasks.push({ query: item.query, scopes: [report, scope, archive] });
		tasks.push({ query: item.query, scopes: [{ ...report, zones: ['transcript'] }] });
	}
	for (const query of ['тренировка 2099', 'прогноз курса тугрика на Марсе 2042', 'жжжщщщ ыыыъъъ', 'zornhau']) {
		tasks.push({ query, scopes: [archive] });
	}
	let legacy: SearchResponse[] = [];
	const fetches: Record<string, string[]> = { legacy: [], compact: [] };
	for (const mode of ['legacy', 'compact'] as const) {
		resetSearchIndex();
		vi.stubGlobal('caches', undefined);
		vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
			const name = String(input).split('/').pop()!;
			fetches[mode].push(name);
			const text = mode === 'legacy' && name === 'manifest.json' ? undefined : files.get(name);
			return new Response(text ?? '', { status: text === undefined ? 404 : 200 });
		}));
		await whenSearchComplete();
		const responses: SearchResponse[] = [];
		for (const [i, task] of tasks.entries()) {
			const response = await searchScoped(task.query, task.scopes, task.scopes[0].kind === 'archive' ? 30 : 120);
			expect(response.pending).toBe(false);
			if (mode === 'compact') expect(response, `${i}: ${task.query}`).toEqual(legacy[i]);
			else responses.push(response);
			if (i % 64 === 0) console.log(`Search transport ${mode}: ${i + 1}/${tasks.length}`);
		}
		if (mode === 'legacy') legacy = responses;
	}
	expect(fetches.compact).not.toContain('index-core.json');
	expect(fetches.compact).not.toContain('index-transcripts.json');
	expect(fetches.compact).not.toContain('chapter-titles.json');
	expect(fetches.compact.filter(name => name.startsWith('packed-'))).toHaveLength(3);
	const result = { scenarios: tasks.length, indexedReports: indexed.size, documents: manifest.documents,
		identical: true, compared: 'all hits, order, scores, snippets, titles, timestamps, URLs, corrections, scopes and fallback',
		transfer: manifest.transfer, fetches };
	if (process.env.SEARCH_TRANSFER_OUTPUT) writeFileSync(process.env.SEARCH_TRANSFER_OUTPUT, JSON.stringify(result, null, 2) + '\n');
	console.log(`Search transport parity: ${tasks.length} scenarios, identical complete responses`);
}, 300000);

import MiniSearch from 'minisearch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectionReportsMatchingFacets } from './collection-facets';
import type { Collection } from './data/collections';
import { configureSearchReportMetadata, resetSearchIndex, searchScoped, whenSearchComplete } from './search-core';
import { searchHitKey } from './search-hit-key';
import { searchIndexOptions } from './search-index-schema.js';
import type { SearchScope } from './search-types';

const collections: Collection[] = [
	{ slug: 'longsword', title: 'Меч', subtitle: '', items: ['long'], facets: { weapons: ['Длинный меч'] } },
	{ slug: 'sabre', title: 'Сабля', subtitle: '', items: ['sabre'], facets: { weapons: ['Сабля'] } },
	{ slug: 'katana', title: 'Катана', subtitle: '', items: ['katana'], facets: { weapons: ['Катана'] } }
];
function scope(weapons: string[] = []): SearchScope {
	return { kind: 'archive', label: 'Архив', reportSlugs: collections.flatMap(c => collectionReportsMatchingFacets(c, { weapons })) };
}
const chapter = (reportSlug: string, chapterIndex: number, kind = 'chapter', suffix = '') => ({
	id: `${reportSlug}:${chapterIndex}:${kind}:${suffix}`, kind, reportSlug, chapterIndex,
	title: `Глава ${chapterIndex}`, text: 'Длинное острие помогает контролировать клинок.',
	field_title: 'Длинное острие', field_body: 'Длинное острие помогает контролировать клинок.'
});
const coreDocs = [
	...Array.from({ length: 4 }, (_, i) => chapter('long', i)),
	...Array.from({ length: 3 }, (_, i) => chapter('sabre', i)),
	chapter('katana', 0),
	// One chapter must not consume the page with repeated key points/windows.
	...Array.from({ length: 35 }, (_, i) => chapter('long', 0, 'thesis', String(i))),
	...[10, 20].map(start => ({ id: `exercise:${start}`, kind: 'material', materialKind: 'exercise',
		reportSlug: 'long', title: 'Упражнения', start, text: 'Длинное острие.', field_body: 'Длинное острие.' }))
];
const transcriptDocs = [chapter('long', 0, 'transcript', 'a'), chapter('long', 0, 'transcript', 'b'), chapter('long', 3, 'transcript')];
function index(docs: object[]) {
	const mini = new MiniSearch(searchIndexOptions);
	mini.addAll(docs);
	return JSON.stringify(mini);
}
const core = index(coreDocs), transcripts = index(transcriptDocs);

beforeEach(async () => {
	resetSearchIndex();
	configureSearchReportMetadata([]);
	vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
		const name = String(input).split('/').pop();
		if (name === 'index-core.json') return new Response(core);
		if (name === 'index-transcripts.json') return new Response(transcripts);
		return new Response('{}', { status: name === 'manifest.json' ? 404 : 200 });
	}));
	await whenSearchComplete();
});
afterEach(() => { resetSearchIndex(); configureSearchReportMetadata(undefined); vi.unstubAllGlobals(); });

describe('distinct search counts and filtering', () => {
	it.each([1, 3, 30])('counts all destinations before a page limit of %s', async limit => {
		const result = await searchScoped('длинное острие', [scope()], limit);
		expect(result.total).toBe(10);
		expect(result.hits).toHaveLength(Math.min(limit, 10));
		expect(new Set(result.hits.map(searchHitKey)).size).toBe(result.hits.length);
		expect(result.hasMore).toBe(limit < 10);
	});

	it('narrows the complete count with a weapon filter and restores it when cleared', async () => {
		const all = await searchScoped('длинное острие', [scope()], 3, true);
		const filtered = await searchScoped('длинное острие', [scope(['Длинный меч'])], 3, true);
		const restored = await searchScoped('длинное острие', [scope()], 3, true);
		expect([all.total, filtered.total, restored.total]).toEqual([10, 6, 10]);
		expect(filtered.hits.every(h => h.reportSlug === 'long')).toBe(true);
		const allKeys = new Set(all.hits.map(searchHitKey));
		expect(filtered.hits.every(h => allKeys.has(searchHitKey(h)))).toBe(true);
		expect(restored.hits).toEqual(all.hits);
	});

	it('opens the complete list without changing the first page or merging timed exercises', async () => {
		const first = await searchScoped('длинное острие', [scope()], 3);
		const full = await searchScoped('длинное острие', [scope()], 3, true);
		expect(full.total).toBe(first.total);
		expect(full.hits).toHaveLength(full.total);
		expect(full.hits.slice(0, 3)).toEqual(first.hits);
		expect(full.hasMore).toBe(false);
		expect(full.hits.filter(h => h.kind === 'material').map(h => h.start).sort()).toEqual([10, 20]);
	});

	it('applies zone filters before merging passages in the same chapter', async () => {
		const result = await searchScoped('длинное острие', [{ ...scope(), zones: ['transcript'] }], 1, true);
		expect(result.total).toBe(2);
		expect(result.hits.every(h => h.zone === 'transcript')).toBe(true);
	});

	it('returns a zero count for an empty filtered scope', async () => {
		const result = await searchScoped('длинное острие', [scope(['Рапира'])], 3);
		expect(result).toMatchObject({ total: 0, hasMore: false, hits: [], matchKind: 'empty' });
	});

	it('counts distinct destinations in the broader scope selected by fallback', async () => {
		const result = await searchScoped('длинное острие', [scope(['Рапира']), scope()], 3);
		expect(result).toMatchObject({ total: 10, hasMore: true, fallback: true });
		expect(result.resultScope).toEqual(scope());
	});
});

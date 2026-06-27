import MiniSearch, { type SearchResult } from 'minisearch';
import type { SearchHitKind } from '$lib/search-types';
import { stemRu } from '$lib/stem-ru';

export type { SearchHitKind, SearchHit, ReportGroup, ChapterGroup } from '$lib/search-types';
export { groupByReport, groupByChapter } from '$lib/search-group';

interface IndexedDoc {
	id: string;
	kind: SearchHitKind;
	reportSlug: string;
	reportTitle: string;
	chapterIndex?: number;
	start?: number;
	title: string;
	text: string;
	href: string;
	field_title: string;
	field_body: string;
	field_tags: string;
}

function norm(s: string): string {
	return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function queryWords(q: string): string[] {
	return norm(q)
		.split(/[^\p{L}\p{N}]+/u)
		.filter((w) => w.length >= 2);
}

function snippet(text: string, query: string, max = 96): string {
	const hay = norm(text);
	const candidates = [norm(query), ...queryWords(query)];

	let i = -1;
	let hitLen = 0;
	for (const c of candidates) {
		if (!c) continue;
		const at = hay.indexOf(c);
		if (at >= 0) {
			i = at;
			hitLen = c.length;
			break;
		}
	}

	if (i < 0) return text.slice(0, max) + (text.length > max ? '…' : '');

	const start = Math.max(0, i - 28);
	const end = Math.min(text.length, i + hitLen + 56);
	const chunk = text.slice(start, end).trim();
	return (start > 0 ? '…' : '') + chunk + (end < text.length ? '…' : '');
}

function processTerm(term: string): string | null {
	const t = norm(term).replace(/[^\p{L}\p{N}]/gu, '');
	if (t.length < 2) return null;
	return stemRu(t);
}

let mini: MiniSearch<IndexedDoc> | null = null;
let indexPromise: Promise<MiniSearch<IndexedDoc>> | null = null;

async function loadIndex(): Promise<MiniSearch<IndexedDoc>> {
	if (mini) return mini;
	if (!indexPromise) {
		indexPromise = import('$lib/data/search-index.json').then((mod) => {
			const docs = (mod.default ?? mod) as IndexedDoc[];
			const search = new MiniSearch<IndexedDoc>({
				idField: 'id',
				fields: ['field_title', 'field_body', 'field_tags'],
				storeFields: [
					'kind',
					'reportSlug',
					'reportTitle',
					'chapterIndex',
					'start',
					'title',
					'text',
					'href'
				],
				processTerm
			});
			search.addAll(docs);
			mini = search;
			return search;
		});
	}
	return indexPromise;
}

function toHit(res: SearchResult, query: string): import('$lib/search-types').SearchHit {
	const doc = res as unknown as IndexedDoc;
	return {
		kind: doc.kind,
		reportSlug: doc.reportSlug,
		reportTitle: doc.reportTitle,
		chapterIndex: doc.chapterIndex,
		title: doc.title,
		snippet: snippet(doc.text, query),
		href: doc.href,
		start: doc.start,
		score: res.score
	};
}

const searchOptions = {
	boost: { field_title: 3, field_tags: 2 },
	prefix: true,
	fuzzy: 0.2,
	combineWith: 'AND' as const
};

/** Поиск по архиву. `scopeSlugs` — slug'и отчётов для сужения (напр. коллекция). */
export async function searchReports(
	query: string,
	limit = 40,
	scopeSlugs?: string[]
): Promise<import('$lib/search-types').SearchHit[]> {
	const q = norm(query);
	if (q.length < 2) return [];

	const scoped = scopeSlugs?.length ? new Set(scopeSlugs) : null;
	const index = await loadIndex();
	const results = index.search(query, {
		...searchOptions,
		filter: scoped ? (r) => scoped.has((r as unknown as IndexedDoc).reportSlug) : undefined
	});

	return results.slice(0, limit).map((r) => toHit(r, query));
}

/** Поиск внутри одного отчёта. */
export async function searchReport(
	reportSlug: string,
	query: string,
	limit = 40
): Promise<import('$lib/search-types').SearchHit[]> {
	const q = norm(query);
	if (q.length < 2) return [];

	const index = await loadIndex();
	const results = index.search(query, {
		...searchOptions,
		filter: (r) => {
			const d = r as unknown as IndexedDoc;
			return d.reportSlug === reportSlug && d.kind !== 'report';
		}
	});

	return results.slice(0, limit).map((r) => toHit(r, query));
}

/** Прогреть индекс (напр. при idle). */
export function preloadSearchIndex(): void {
	void loadIndex();
}

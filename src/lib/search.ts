import MiniSearch, { type SearchResult } from 'minisearch';
import { reports } from '$lib/data';
import type { Report } from '$lib/types';
import { stemRu } from '$lib/stem-ru';

export type SearchHitKind = 'report' | 'chapter' | 'transcript';

export interface SearchHit {
	kind: SearchHitKind;
	reportSlug: string;
	reportTitle: string;
	/** Индекс блока (0-based), если попадание внутри отчёта */
	chapterIndex?: number;
	title: string;
	snippet: string;
	/** Якорь блока, напр. #ch-3 */
	href: string;
	/** Тайм-код для перемотки видео */
	start?: number;
	score: number;
}

/** Группа попаданий одного отчёта (для глобальной выдачи). */
export interface ReportGroup {
	reportSlug: string;
	reportTitle: string;
	/** Ссылка на корень отчёта */
	href: string;
	score: number;
	hits: SearchHit[];
}

/** Группа попаданий одного блока (для поиска внутри отчёта). */
export interface ChapterGroup {
	/** null — для записи целиком / главного тезиса */
	chapterIndex: number | null;
	title: string;
	href: string;
	start?: number;
	score: number;
	hits: SearchHit[];
}

// --- Нормализация / сниппет -------------------------------------------------

function norm(s: string): string {
	return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/** Слова запроса для подсветки сниппета (без стемминга — ищем как есть). */
function queryWords(q: string): string[] {
	return norm(q)
		.split(/[^\p{L}\p{N}]+/u)
		.filter((w) => w.length >= 2);
}

/** Сниппет вокруг первого вхождения запроса или любого его слова. */
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

// --- Индекс -----------------------------------------------------------------

interface IndexedDoc {
	id: string;
	kind: SearchHitKind;
	reportSlug: string;
	reportTitle: string;
	chapterIndex?: number;
	start?: number;
	/** Отображаемый заголовок попадания */
	title: string;
	/** Исходный текст для сниппета */
	text: string;
	href: string;
	// индексируемые поля
	field_title: string;
	field_body: string;
	field_tags: string;
}

function processTerm(term: string): string | null {
	const t = norm(term).replace(/[^\p{L}\p{N}]/gu, '');
	if (t.length < 2) return null;
	return stemRu(t);
}

function buildDocs(): IndexedDoc[] {
	const docs: IndexedDoc[] = [];

	for (const report of reports) {
		const baseHref = `/reports/${report.slug}/`;
		const common = { reportSlug: report.slug, reportTitle: report.title };

		docs.push({
			id: `r:${report.slug}`,
			kind: 'report',
			...common,
			title: report.title,
			text: report.subtitle,
			href: baseHref,
			field_title: report.title,
			field_body: [report.subtitle, report.source_name].filter(Boolean).join(' '),
			field_tags: report.tags.join(' ')
		});

		report.chapters.forEach((ch, ci) => {
			const chHref = `${baseHref}#ch-${ci + 1}`;

			docs.push({
				id: `c:${report.slug}:${ci}`,
				kind: 'chapter',
				...common,
				chapterIndex: ci,
				start: ch.start,
				title: ch.title,
				text: ch.summary || ch.title,
				href: chHref,
				field_title: ch.title,
				field_body: [ch.title, ch.summary].filter(Boolean).join(' '),
				field_tags: ''
			});

			(ch.segments ?? []).forEach((seg, i) => {
				docs.push({
					id: `s:${report.slug}:${ci}:${i}`,
					kind: 'transcript',
					...common,
					chapterIndex: ci,
					start: seg.start,
					title: ch.title,
					text: seg.text,
					href: chHref,
					field_title: '',
					field_body: seg.text,
					field_tags: ''
				});
			});
		});
	}

	return docs;
}

let mini: MiniSearch<IndexedDoc> | null = null;

function index(): MiniSearch<IndexedDoc> {
	if (mini) return mini;
	mini = new MiniSearch<IndexedDoc>({
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
	mini.addAll(buildDocs());
	return mini;
}

function toHit(res: SearchResult, query: string): SearchHit {
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

// --- Публичный API ----------------------------------------------------------

/**
 * Поиск по архиву. `scope` задаётся явно: `undefined` — весь архив,
 * массив отчётов — сужение до подмножества (например, коллекции).
 */
export function searchReports(query: string, limit = 40, scope?: Report[]): SearchHit[] {
	const q = norm(query);
	if (q.length < 2) return [];

	const scoped = scope ? new Set(scope.map((r) => r.slug)) : null;
	const results = index().search(query, {
		...searchOptions,
		filter: scoped ? (r) => scoped.has((r as unknown as IndexedDoc).reportSlug) : undefined
	});

	return results.slice(0, limit).map((r) => toHit(r, query));
}

/** Поиск внутри одного отчёта: блоки, тезисы, фразы транскрипта. */
export function searchReport(report: Report, query: string, limit = 40): SearchHit[] {
	const q = norm(query);
	if (q.length < 2) return [];

	const results = index().search(query, {
		...searchOptions,
		filter: (r) => {
			const d = r as unknown as IndexedDoc;
			return d.reportSlug === report.slug && d.kind !== 'report';
		}
	});

	return results.slice(0, limit).map((r) => toHit(r, query));
}

// --- Группировка ------------------------------------------------------------

/** Группирует попадания по отчётам; в каждой группе оставляет лучшие. */
export function groupByReport(hits: SearchHit[], perGroup = 3, maxGroups = 8): ReportGroup[] {
	const groups = new Map<string, ReportGroup>();

	for (const hit of hits) {
		let g = groups.get(hit.reportSlug);
		if (!g) {
			g = {
				reportSlug: hit.reportSlug,
				reportTitle: hit.reportTitle,
				href: `/reports/${hit.reportSlug}/`,
				score: hit.score,
				hits: []
			};
			groups.set(hit.reportSlug, g);
		}
		g.score = Math.max(g.score, hit.score);
		if (g.hits.length < perGroup) g.hits.push(hit);
	}

	return [...groups.values()].sort((a, b) => b.score - a.score).slice(0, maxGroups);
}

/** Группирует попадания по блокам (для поиска внутри отчёта). */
export function groupByChapter(hits: SearchHit[], perGroup = 5): ChapterGroup[] {
	const groups = new Map<string, ChapterGroup>();

	for (const hit of hits) {
		// В поиске по отчёту попадания всегда привязаны к блоку (блок/речь).
		const key = String(hit.chapterIndex);
		let g = groups.get(key);
		if (!g) {
			g = {
				chapterIndex: hit.chapterIndex ?? null,
				title: hit.title,
				href: hit.href,
				start: hit.start,
				score: hit.score,
				hits: []
			};
			groups.set(key, g);
		}
		g.score = Math.max(g.score, hit.score);
		if (g.hits.length < perGroup) g.hits.push(hit);
	}

	return [...groups.values()].sort((a, b) => b.score - a.score);
}

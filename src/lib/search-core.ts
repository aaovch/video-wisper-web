import { base } from '$app/paths';
import MiniSearch, { type SearchOptions, type SearchResult } from 'minisearch';
import type {
	SearchHitKind,
	SearchMatchKind,
	SearchResponse,
	SearchScope,
	SearchZone
} from '$lib/search-types';
import { stemRu } from '$lib/stem-ru';
import { getReportSummary } from '$lib/data/report-meta';

export type {
	SearchHitKind,
	SearchMatchKind,
	SearchResultKind,
	SearchScope,
	SearchResponse,
	SearchZone,
	SearchHit,
	ReportGroup,
	ChapterGroup
} from '$lib/search-types';
export { groupByReport, groupByChapter } from '$lib/search-group';

interface IndexedDoc {
	id: string | number;
	kind: SearchHitKind;
	/** Не хранится в индексе v3 — вычисляется из kind (фолбэк для старых фикстур). */
	zone?: SearchZone;
	reportSlug: string;
	/** Не хранится в индексе v3 — берётся из report-meta. */
	reportTitle?: string;
	chapterIndex?: number;
	start?: number;
	/** Хранится только у material-документов; остальным вычисляется. */
	title?: string;
	text: string;
	/** Не хранится в индексе v3 — вычисляется из kind + slug + chapterIndex. */
	href?: string;
	field_title: string;
	field_body: string;
	field_tags: string;
	reasonTags?: string;
}

const ZONE_BY_KIND: Record<SearchHitKind, SearchZone> = {
	report: 'reports',
	overview: 'theses',
	chapter: 'chapters',
	thesis: 'theses',
	transcript: 'transcript',
	material: 'additional'
};

function docZone(doc: IndexedDoc): SearchZone {
	return doc.zone ?? ZONE_BY_KIND[doc.kind] ?? 'reports';
}

function docReportTitle(doc: IndexedDoc): string {
	return doc.reportTitle ?? getReportSummary(doc.reportSlug)?.title ?? doc.reportSlug;
}

function docTitle(doc: IndexedDoc): string {
	if (doc.title !== undefined) return doc.title;
	if (doc.kind === 'overview') return 'Главное';
	if (doc.kind === 'chapter' || doc.kind === 'thesis' || doc.kind === 'transcript') {
		const chapterTitle =
			doc.chapterIndex !== undefined
				? chapterTitles?.[doc.reportSlug]?.[doc.chapterIndex]
				: undefined;
		return chapterTitle ?? docReportTitle(doc);
	}
	return docReportTitle(doc);
}

function docHref(doc: IndexedDoc): string {
	if (doc.href !== undefined) return doc.href;
	const baseHref = `/reports/${doc.reportSlug}/`;
	switch (doc.kind) {
		case 'report':
			return baseHref;
		case 'overview':
			return `${baseHref}#overview-title`;
		case 'material':
			return `${baseHref}#additional-title`;
		default:
			return `${baseHref}#ch-${(doc.chapterIndex ?? 0) + 1}`;
	}
}

interface ParsedQuery {
	raw: string;
	words: string[];
	meaningfulWords: string[];
	stems: string[];
}

const STOP_WORDS = new Set([
	'а', 'без', 'бы', 'был', 'была', 'были', 'было', 'быть', 'в', 'вам', 'вас', 'весь', 'во',
	'вот', 'все', 'всего', 'вы', 'где', 'да', 'для', 'до', 'его', 'ее', 'если', 'есть', 'еще',
	'же', 'за', 'и', 'из', 'или', 'им', 'их', 'к', 'как', 'какая', 'какие', 'какой', 'когда',
	'который', 'кто', 'ли', 'мне', 'можно', 'мы', 'на', 'над', 'надо', 'наш', 'не', 'него',
	'нее', 'нет', 'ни', 'но', 'ну', 'о', 'об', 'один', 'он', 'она', 'они', 'оно', 'от', 'по',
	'под', 'при', 'про', 'против', 'с', 'со', 'так', 'такой', 'там', 'то', 'того', 'тоже', 'только', 'у',
	'уже', 'что', 'чтобы', 'это', 'этот', 'я'
]);

function norm(value: string): string {
	return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function queryWords(query: string): string[] {
	return norm(query)
		.split(/[^\p{L}\p{N}]+/u)
		.filter((word) => word.length >= 2);
}

function parseQuery(query: string): ParsedQuery {
	const raw = norm(query);
	const words = queryWords(raw);
	const meaningfulWords = words.filter((word) => !STOP_WORDS.has(word));
	const effectiveWords = meaningfulWords.length ? meaningfulWords : words;
	return {
		raw,
		words,
		meaningfulWords: effectiveWords,
		stems: [...new Set(effectiveWords.map((word) => stemRu(word)))]
	};
}

function processTerm(term: string): string | null {
	const token = norm(term).replace(/[^\p{L}\p{N}]/gu, '');
	if (token.length < 2 || STOP_WORDS.has(token)) return null;
	return stemRu(token);
}

const miniSearchOptions = {
	idField: 'id',
	fields: ['field_title', 'field_body', 'field_tags'],
	// Должно совпадать со scripts/build-search-index.mjs (индекс v3).
	storeFields: ['kind', 'reportSlug', 'chapterIndex', 'start', 'title', 'text', 'reasonTags'],
	processTerm
};

/**
 * Индекс порезан на два шарда (см. scripts/build-search-index.mjs):
 * лёгкое ядро (отчёты/главы/тезисы/материалы) грузится и парсится мгновенно,
 * тяжёлые transcript-окна догружаются фоном. Поиск работает сразу по ядру,
 * а по готовности транскриптов компоненты дозапускают запрос (`pending`).
 */
let coreMini: MiniSearch<IndexedDoc> | null = null;
let corePromise: Promise<MiniSearch<IndexedDoc>> | null = null;
let transcriptMini: MiniSearch<IndexedDoc> | null = null;
let transcriptPromise: Promise<void> | null = null;
/** Не ретраим упавший transcript-шард в рамках сессии — ядро продолжает работать. */
let transcriptFailed = false;
/** slug → заголовки глав; лежит рядом с индексом, не в eager-бандле. */
let chapterTitles: Record<string, string[]> | null = null;

/** Необязательная карта заголовков: при сбое выдача откатится к названию отчёта. */
async function loadChapterTitles(): Promise<void> {
	if (chapterTitles) return;
	try {
		const response = await fetch(`${base}/search/chapter-titles.json`);
		if (!response.ok) return;
		const parsed: unknown = await response.json();
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			chapterTitles = parsed as Record<string, string[]>;
		}
	} catch {
		/* карта опциональна */
	}
}

function fetchShard(file: string): Promise<MiniSearch<IndexedDoc>> {
	return fetch(`${base}/search/${file}`)
		.then((response) => {
			if (!response.ok) throw new Error(`Search index HTTP ${response.status}`);
			return response.text();
		})
		.then((serialized) => MiniSearch.loadJSONAsync<IndexedDoc>(serialized, miniSearchOptions));
}

function loadCore(): Promise<MiniSearch<IndexedDoc>> {
	if (coreMini) return Promise.resolve(coreMini);
	if (!corePromise) {
		const titlesReady = loadChapterTitles();
		corePromise = fetchShard('index-core.json')
			.then(async (loaded) => {
				await titlesReady;
				coreMini = loaded;
				return loaded;
			})
			.catch((error) => {
				corePromise = null;
				throw error;
			});
	}
	return corePromise;
}

/** Фоновая догрузка transcript-шарда; ошибок наружу не отдаёт. */
function loadTranscripts(): Promise<void> {
	if (transcriptMini || transcriptFailed) return Promise.resolve();
	if (!transcriptPromise) {
		transcriptPromise = fetchShard('index-transcripts.json')
			.then((loaded) => {
				transcriptMini = loaded;
			})
			.catch(() => {
				transcriptFailed = true;
			});
	}
	return transcriptPromise;
}

/** Транскрипты ещё в пути — выдача может пополниться, стоит повторить запрос. */
function transcriptsPending(): boolean {
	return !transcriptMini && !transcriptFailed;
}

/** Резолвится, когда transcript-шард догрузился (или окончательно упал). */
export function whenSearchComplete(): Promise<void> {
	return loadTranscripts();
}

/** Ищет по всем готовым шардам; id глобально уникальны, дедуп — на случай тестовых фикстур. */
function searchShards(query: string, options: SearchOptions): SearchResult[] {
	if (!coreMini) return [];
	const results = coreMini.search(query, options);
	if (!transcriptMini) return results;
	const seen = new Set(results.map((result) => String(result.id)));
	for (const result of transcriptMini.search(query, options)) {
		if (!seen.has(String(result.id))) results.push(result);
	}
	return results;
}

function suggestShards(query: string, options: SearchOptions): string | undefined {
	if (!coreMini) return undefined;
	const suggestions = [
		...coreMini.autoSuggest(query, options),
		...(transcriptMini?.autoSuggest(query, options) ?? [])
	].sort((a, b) => b.score - a.score);
	return suggestions[0]?.suggestion;
}

function snippet(text: string, parsed: ParsedQuery, max = 156): string {
	const normalizedText = norm(text);
	const candidates = [parsed.raw, ...parsed.meaningfulWords].filter(Boolean);
	let hitIndex = -1;
	let hitLength = 0;

	for (const candidate of candidates) {
		const at = normalizedText.indexOf(candidate);
		if (at >= 0 && (hitIndex < 0 || at < hitIndex)) {
			hitIndex = at;
			hitLength = candidate.length;
		}
	}
	if (hitIndex < 0) {
		const queryStems = new Set(parsed.stems);
		for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
			if (!queryStems.has(stemRu(norm(match[0])))) continue;
			hitIndex = match.index;
			hitLength = match[0].length;
			break;
		}
	}

	if (hitIndex < 0) return text.slice(0, max).trim() + (text.length > max ? '…' : '');
	const start = Math.max(0, hitIndex - 52);
	const end = Math.min(text.length, Math.max(start + max, hitIndex + hitLength + 72));
	const chunk = text.slice(start, end).trim();
	return `${start > 0 ? '…' : ''}${chunk}${end < text.length ? '…' : ''}`;
}

function matchReason(
	result: SearchResult,
	doc: IndexedDoc,
	parsed: ParsedQuery,
	matchMode: SearchMatchKind
): { labels: string[]; kind: 'tag' | 'semantic' | 'correction' } | undefined {
	const visibleText = norm(`${docReportTitle(doc)} ${docTitle(doc)} ${doc.text}`);
	const visibleStems = new Set(queryWords(visibleText).map(stemRu));
	if (parsed.stems.some((stem) => visibleStems.has(stem))) return undefined;
	const tagText = norm(doc.reasonTags ?? '');
	const tagMatches = parsed.meaningfulWords.filter((word) => tagText.includes(word)).slice(0, 3);
	if (tagMatches.length) return { labels: tagMatches, kind: 'tag' };
	if (matchMode === 'correction') {
		const labels = [...new Set(result.terms.map((term) => norm(term)).filter(Boolean))].slice(0, 3);
		return labels.length ? { labels, kind: 'correction' } : undefined;
	}
	if (matchMode !== 'semantic') return undefined;

	const matchedStems = new Set(result.terms.map((term) => stemRu(norm(term))));
	const queryStems = new Set(parsed.stems);
	const canonicalByStem = new Map<string, string>();
	for (const concept of semanticConcepts) {
		const conceptStems = concept.flatMap((phrase) => queryWords(phrase).map(stemRu));
		if (!conceptStems.some((stem) => queryStems.has(stem))) continue;
		for (const phrase of concept) {
			for (const word of queryWords(phrase)) {
				const stem = stemRu(word);
				if (!canonicalByStem.has(stem)) canonicalByStem.set(stem, word);
			}
		}
	}

	const labels: string[] = [];
	const usedStems = new Set<string>();
	for (const word of queryWords(`${docTitle(doc)} ${doc.text}`)) {
		if (STOP_WORDS.has(word)) continue;
		const stem = stemRu(word);
		if (!matchedStems.has(stem) || usedStems.has(stem)) continue;
		usedStems.add(stem);
		labels.push(canonicalByStem.get(stem) ?? word);
		if (labels.length >= 3) break;
	}
	return labels.length ? { labels, kind: 'semantic' } : undefined;
}

function toHit(
	result: SearchResult,
	parsed: ParsedQuery,
	matchMode: SearchMatchKind = 'exact'
): import('$lib/search-types').SearchHit {
	const doc = result as unknown as IndexedDoc;
	const reason = matchReason(result, doc, parsed, matchMode);
	return {
		kind: doc.kind,
		zone: docZone(doc),
		reportSlug: doc.reportSlug,
		reportTitle: docReportTitle(doc),
		chapterIndex: doc.chapterIndex,
		title: docTitle(doc),
		snippet: snippet(doc.text, parsed),
		matchKind: matchMode,
		matchReason: reason?.labels,
		matchReasonKind: reason?.kind,
		href: docHref(doc),
		start: doc.start,
		score: result.score
	};
}

const semanticConcepts: string[][] = [
	['дистанция', 'мера', 'сближение', 'отход', 'дальний', 'ближний', 'дистанционный контроль'],
	['атака', 'наступление', 'вход', 'удар', 'укол', 'подготовка атаки', 'инициатива'],
	['защита', 'оборона', 'парад', 'парирование', 'ответ', 'контратака'],
	['темп', 'тайминг', 'ритм', 'момент', 'скорость действия'],
	['давление', 'прессинг', 'преследование', 'угроза', 'вытеснение'],
	['финт', 'обман', 'провокация', 'ложное действие', 'вызов реакции'],
	['работа ног', 'шаг', 'выпад', 'перемещение', 'маневр', 'шагистика'],
	['работа клинком', 'соединение', 'захват', 'связывание', 'контроль оружия'],
	['тренировка', 'упражнение', 'дрилл', 'практика', 'задание'],
	['тренер', 'методика', 'обучение', 'группа', 'обратная связь', 'исправление ошибки'],
	['тактика', 'решение', 'намерение', 'выбор действия', 'план боя'],
	['сила', 'офп', 'подготовка', 'мощность', 'скорость', 'выносливость'],
	['травма', 'безопасность', 'восстановление', 'нагрузка', 'боль'],
	['длинный меч', 'лонгсворд', 'longsword'],
	['сабля', 'сабельный'],
	['рапира', 'укол', 'колющее оружие'],
	['катана', 'кендзюцу', 'японский меч']
];

function expandSemanticQuery(parsed: ParsedQuery): string[] {
	const expanded = new Set(parsed.meaningfulWords);
	const queryStems = new Set(parsed.stems);
	for (const concept of semanticConcepts) {
		const conceptStems = concept.flatMap((phrase) => queryWords(phrase).map(stemRu));
		if (conceptStems.some((stem) => queryStems.has(stem))) {
			for (const term of concept) {
				if (queryWords(term).length === 1) expanded.add(term);
			}
		}
	}
	return [...expanded];
}

function rankKind(result: SearchResult): number {
	const kind = (result as unknown as IndexedDoc).kind;
	if (kind === 'chapter') return 1.28;
	if (kind === 'overview') return 1.2;
	if (kind === 'thesis') return 1.14;
	if (kind === 'material') return 1.02;
	if (kind === 'report') return 0.96;
	return 0.74;
}

function signalMultiplier(result: SearchResult, parsed: ParsedQuery): number {
	const doc = result as unknown as IndexedDoc;
	const title = norm(docTitle(doc));
	const body = norm(doc.text ?? '');
	const combined = `${title} ${body}`;
	const combinedStems = new Set(queryWords(combined).map(stemRu));
	const coverage = parsed.stems.length
		? parsed.stems.filter((stem) => combinedStems.has(stem)).length / parsed.stems.length
		: 0;
	let multiplier = 0.58 + coverage * 0.8;
	if (parsed.raw.length >= 4 && combined.includes(parsed.raw)) multiplier += 0.75;
	if (title === parsed.raw) multiplier += 0.7;
	else if (title.startsWith(parsed.raw)) multiplier += 0.42;
	else if (parsed.stems.every((stem) => queryWords(title).map(stemRu).includes(stem))) multiplier += 0.24;
	if (parsed.stems.length > 1 && coverage < 0.5) multiplier *= 0.72;
	return multiplier * rankKind(result);
}

const adaptiveFuzzy: SearchOptions['fuzzy'] = (term) => {
	if (term.length >= 8) return 0.2;
	if (term.length >= 6) return 0.16;
	if (term.length >= 5) return 0.12;
	if (term.length === 4) return 0.25;
	return false;
};

const adaptivePrefix: SearchOptions['prefix'] = (term, index, terms) =>
	index === terms.length - 1 && term.length >= 3;

function mergeResults(target: Map<string, SearchResult>, results: SearchResult[], weight: number) {
	for (const result of results) {
		const id = String(result.id);
		const weightedScore = result.score * weight;
		const previous = target.get(id);
		if (!previous) target.set(id, { ...result, score: weightedScore });
		else target.set(id, { ...result, score: Math.max(previous.score, weightedScore) + Math.min(previous.score, weightedScore) * 0.22 });
	}
}

function diversify(results: SearchResult[], limit: number, insideSingleReport: boolean): SearchResult[] {
	const selected: SearchResult[] = [];
	const deferred: SearchResult[] = [];
	const chapterCounts = new Map<string, number>();
	const reportCounts = new Map<string, number>();

	for (const result of results) {
		const doc = result as unknown as IndexedDoc;
		const chapterKey = `${doc.reportSlug}:${doc.chapterIndex ?? doc.kind}`;
		const chapterCount = chapterCounts.get(chapterKey) ?? 0;
		const reportCount = reportCounts.get(doc.reportSlug) ?? 0;
		const chapterCap = insideSingleReport ? 4 : 2;
		const reportCap = insideSingleReport ? limit : Math.max(5, Math.ceil(limit / 5));
		if (chapterCount >= chapterCap || reportCount >= reportCap) {
			deferred.push(result);
			continue;
		}
		selected.push(result);
		chapterCounts.set(chapterKey, chapterCount + 1);
		reportCounts.set(doc.reportSlug, reportCount + 1);
		if (selected.length >= limit) return selected;
	}

	for (const result of deferred) {
		if (selected.length >= limit) break;
		selected.push(result);
	}
	return selected;
}

interface TieredSearchResult {
	hits: import('$lib/search-types').SearchHit[];
	matchKind: import('$lib/search-types').SearchResultKind;
	correctedQuery?: string;
}

function rankedHits(
	results: SearchResult[],
	parsed: ParsedQuery,
	matchKind: SearchMatchKind,
	limit: number,
	insideSingleReport: boolean,
	weight = 1
): import('$lib/search-types').SearchHit[] {
	const ranked = results
		.map((result) => ({ ...result, score: result.score * weight * signalMultiplier(result, parsed) }))
		.sort((a, b) => b.score - a.score);
	return diversify(ranked, limit, insideSingleReport).map((result) => toHit(result, parsed, matchKind));
}

async function executeTieredSearch(
	query: string,
	limit: number,
	filter: ((result: SearchResult) => boolean) | undefined,
	insideSingleReport: boolean
): Promise<TieredSearchResult> {
	const parsed = parseQuery(query);
	if (parsed.raw.length < 2 || !parsed.meaningfulWords.length) return { hits: [], matchKind: 'empty' };
	await loadCore();
	void loadTranscripts();
	const directQuery = parsed.meaningfulWords.join(' ');
	const baseOptions = { boost: { field_title: 4.2, field_tags: 1.55 }, filter };

	const exact = searchShards(directQuery, {
		...baseOptions,
		combineWith: 'AND',
		fuzzy: false,
		prefix: false
	});
	if (exact.length) {
		return { hits: rankedHits(exact, parsed, 'exact', limit, insideSingleReport, 2.05), matchKind: 'exact' };
	}

	const prefix = searchShards(directQuery, {
		...baseOptions,
		combineWith: 'AND',
		fuzzy: false,
		prefix: adaptivePrefix
	});
	if (prefix.length) {
		return { hits: rankedHits(prefix, parsed, 'prefix', limit, insideSingleReport, 1.82), matchKind: 'prefix' };
	}

	const correctionRanked = new Map<string, SearchResult>();
	const suggestion = suggestShards(directQuery, {
		...baseOptions,
		combineWith: 'AND',
		fuzzy: 0.34,
		prefix: false
	});
	let correctedQuery: string | undefined;
	if (suggestion && norm(suggestion) !== directQuery) {
		const corrected = searchShards(suggestion, {
			...baseOptions,
			combineWith: 'AND',
			fuzzy: false,
			prefix: false
		});
		if (corrected.length) {
			correctedQuery = suggestion;
			mergeResults(correctionRanked, corrected, 1.72);
		}
	}
	mergeResults(
		correctionRanked,
		searchShards(directQuery, {
			...baseOptions,
			combineWith: 'AND',
			fuzzy: adaptiveFuzzy,
			prefix: false
		}),
		1.35
	);
	if (correctionRanked.size) {
		return {
			hits: rankedHits([...correctionRanked.values()], parsed, 'correction', limit, insideSingleReport),
			matchKind: 'correction',
			correctedQuery
		};
	}

	const semanticRanked = new Map<string, SearchResult>();
	mergeResults(
		semanticRanked,
		searchShards(directQuery, {
			...baseOptions,
			combineWith: 'OR',
			fuzzy: adaptiveFuzzy,
			prefix: false
		}),
		parsed.stems.length > 1 ? 0.62 : 1
	);
	const expandedTerms = expandSemanticQuery(parsed);
	if (expandedTerms.length > parsed.meaningfulWords.length) {
		mergeResults(
			semanticRanked,
			searchShards(expandedTerms.join(' '), {
				...baseOptions,
				combineWith: 'OR',
				fuzzy: false,
				prefix: false
			}),
			0.26
		);
	}
	if (semanticRanked.size) {
		return {
			hits: rankedHits(
				[...semanticRanked.values()],
				parsed,
				'semantic',
				Math.min(limit, insideSingleReport ? 8 : 16),
				insideSingleReport
			),
			matchKind: 'semantic'
		};
	}

	return { hits: [], matchKind: 'empty' };
}

async function executeExactSearch(
	query: string,
	limit: number,
	filter: ((result: SearchResult) => boolean) | undefined,
	insideSingleReport: boolean
): Promise<import('$lib/search-types').SearchHit[]> {
	const parsed = parseQuery(query);
	if (parsed.raw.length < 2 || !parsed.meaningfulWords.length) return [];
	await loadCore();
	void loadTranscripts();
	const results = searchShards(parsed.meaningfulWords.join(' '), {
		boost: { field_title: 4.2, field_tags: 1.55 },
		filter,
		combineWith: 'AND',
		fuzzy: false,
		prefix: false
	});
	const ranked = results
		.map((result) => ({ ...result, score: result.score * 2.05 * signalMultiplier(result, parsed) }))
		.sort((a, b) => b.score - a.score);
	return diversify(ranked, limit, insideSingleReport).map((result) => toHit(result, parsed));
}

/** Search the archive. `scopeSlugs` narrows the index to a collection or active facets. */
export async function searchReports(query: string, limit = 40, scopeSlugs?: string[]) {
	const scoped = scopeSlugs === undefined ? null : new Set(scopeSlugs);
	const filter = scoped
		? (result: SearchResult) => scoped.has((result as unknown as IndexedDoc).reportSlug)
		: undefined;
	return (await executeTieredSearch(query, limit, filter, false)).hits;
}

/** Strict lexical search without typo correction, prefix matching, or semantic expansion. */
export async function searchReportsExact(query: string, limit = 40, scopeSlugs?: string[]) {
	const scoped = scopeSlugs === undefined ? null : new Set(scopeSlugs);
	const filter = scoped
		? (result: SearchResult) => scoped.has((result as unknown as IndexedDoc).reportSlug)
		: undefined;
	return executeExactSearch(query, limit, filter, false);
}

/** Search inside one report, excluding the report-level catalog document. */
export async function searchReport(reportSlug: string, query: string, limit = 40) {
	return (await executeTieredSearch(
		query,
		limit,
		(result) => {
			const doc = result as unknown as IndexedDoc;
			return doc.reportSlug === reportSlug && docZone(doc) !== 'reports';
		},
		true
	)).hits;
}

/** Strict lexical search inside one report. */
export async function searchReportExact(reportSlug: string, query: string, limit = 40) {
	return executeExactSearch(
		query,
		limit,
		(result) => {
			const doc = result as unknown as IndexedDoc;
			return doc.reportSlug === reportSlug && docZone(doc) !== 'reports';
		},
		true
	);
}

function scopeFilter(scope: SearchScope): {
	filter: (result: SearchResult) => boolean;
	insideSingleReport: boolean;
} {
	const zones = scope.zones?.length ? new Set(scope.zones) : null;
	if (scope.kind === 'report') {
		return {
			filter: (result) => {
				const doc = result as unknown as IndexedDoc;
				const zone = docZone(doc);
				return doc.reportSlug === scope.reportSlug && zone !== 'reports' && (!zones || zones.has(zone));
			},
			insideSingleReport: true
		};
	}
	const slugs = new Set(scope.reportSlugs);
	return {
		filter: (result) => {
			const doc = result as unknown as IndexedDoc;
			return slugs.has(doc.reportSlug) && (!zones || zones.has(docZone(doc)));
		},
		insideSingleReport: false
	};
}

/** Search ordered scopes, preferring exact or prefix matches in a broader scope over local fuzzy noise. */
export async function searchScoped(
	query: string,
	scopes: readonly SearchScope[],
	limit = 40
): Promise<SearchResponse> {
	if (!scopes.length) throw new Error('searchScoped requires at least one scope');
	const normalizedQuery = query.trim();
	const requestedScope = scopes[0];
	// Фиксируем до поиска: если транскрипты догрузятся во время запроса,
	// лишний повтор вернёт тот же результат — это безопасно.
	const pending = transcriptsPending();
	let requestedResult: TieredSearchResult | undefined;

	for (let index = 0; index < scopes.length; index += 1) {
		const scope = scopes[index];
		const { filter, insideSingleReport } = scopeFilter(scope);
		const result = await executeTieredSearch(normalizedQuery, limit, filter, insideSingleReport);
		if (index === 0) requestedResult = result;
		if ((result.matchKind === 'exact' || result.matchKind === 'prefix') && result.hits.length) {
			return {
				query: normalizedQuery,
				hits: result.hits,
				matchKind: result.matchKind,
				requestedScope,
				resultScope: scope,
				fallback: index > 0,
				correctedQuery: result.correctedQuery,
				pending
			};
		}
	}

	const result = requestedResult ?? { hits: [], matchKind: 'empty' as const };
	return {
		query: normalizedQuery,
		hits: result.hits,
		matchKind: result.matchKind,
		requestedScope,
		resultScope: requestedScope,
		fallback: false,
		correctedQuery: result.correctedQuery,
		pending
	};
}

/** Drop the cached index so a failed load can be retried and tests can provide a fresh fixture. */
export function resetSearchIndex(): void {
	coreMini = null;
	corePromise = null;
	transcriptMini = null;
	transcriptPromise = null;
	transcriptFailed = false;
	chapterTitles = null;
}

/** Warm the prebuilt index on focus without blocking first paint. */
export function preloadSearchIndex(): void {
	void loadCore()
		.then(() => loadTranscripts())
		.catch(() => undefined);
}

import { base } from '$app/paths';
import MiniSearch, { type SearchOptions, type SearchResult } from 'minisearch';
import type { SearchHitKind, SearchZone } from '$lib/search-types';
import { stemRu } from '$lib/stem-ru';

export type { SearchHitKind, SearchZone, SearchHit, ReportGroup, ChapterGroup } from '$lib/search-types';
export { groupByReport, groupByChapter } from '$lib/search-group';

interface IndexedDoc {
	id: string;
	kind: SearchHitKind;
	zone: SearchZone;
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
	reasonTags?: string;
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
	storeFields: [
		'kind', 'zone', 'reportSlug', 'reportTitle', 'chapterIndex', 'start', 'title', 'text', 'href', 'reasonTags'
	],
	processTerm
};

let mini: MiniSearch<IndexedDoc> | null = null;
let indexPromise: Promise<MiniSearch<IndexedDoc>> | null = null;

async function loadIndex(): Promise<MiniSearch<IndexedDoc>> {
	if (mini) return mini;
	if (!indexPromise) {
		indexPromise = fetch(`${base}/search/index.json`)
			.then((response) => {
				if (!response.ok) throw new Error(`Search index HTTP ${response.status}`);
				return response.text();
			})
			.then((serialized) => MiniSearch.loadJSONAsync<IndexedDoc>(serialized, miniSearchOptions))
			.then((loaded) => {
				mini = loaded;
				return loaded;
			})
			.catch((error) => {
				indexPromise = null;
				throw error;
			});
	}
	return indexPromise;
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
	parsed: ParsedQuery
): { labels: string[]; kind: 'tag' | 'semantic' } | undefined {
	const visibleText = norm(`${doc.reportTitle} ${doc.title} ${doc.text}`);
	const visibleStems = new Set(queryWords(visibleText).map(stemRu));
	if (parsed.stems.some((stem) => visibleStems.has(stem))) return undefined;
	const tagText = norm(doc.reasonTags ?? '');
	const tagMatches = parsed.meaningfulWords.filter((word) => tagText.includes(word)).slice(0, 3);
	if (tagMatches.length) return { labels: tagMatches, kind: 'tag' };

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
	for (const word of queryWords(`${doc.title} ${doc.text}`)) {
		if (STOP_WORDS.has(word)) continue;
		const stem = stemRu(word);
		if (!matchedStems.has(stem) || usedStems.has(stem)) continue;
		usedStems.add(stem);
		labels.push(canonicalByStem.get(stem) ?? word);
		if (labels.length >= 3) break;
	}
	return labels.length ? { labels, kind: 'semantic' } : undefined;
}

function toHit(result: SearchResult, parsed: ParsedQuery): import('$lib/search-types').SearchHit {
	const doc = result as unknown as IndexedDoc;
	const reason = matchReason(result, doc, parsed);
	return {
		kind: doc.kind,
		zone: doc.zone,
		reportSlug: doc.reportSlug,
		reportTitle: doc.reportTitle,
		chapterIndex: doc.chapterIndex,
		title: doc.title,
		snippet: snippet(doc.text, parsed),
		matchReason: reason?.labels,
		matchReasonKind: reason?.kind,
		href: doc.href,
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
	const title = norm(doc.title ?? '');
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

async function executeSearch(
	query: string,
	limit: number,
	filter: ((result: SearchResult) => boolean) | undefined,
	insideSingleReport: boolean
): Promise<import('$lib/search-types').SearchHit[]> {
	const parsed = parseQuery(query);
	if (parsed.raw.length < 2 || !parsed.meaningfulWords.length) return [];
	const index = await loadIndex();
	const directQuery = parsed.meaningfulWords.join(' ');
	const baseOptions = { boost: { field_title: 4.2, field_tags: 1.55 }, filter };
	const ranked = new Map<string, SearchResult>();
	const directIds = new Set<string>();
	let correctedQuery: ParsedQuery | null = null;
	const rememberDirect = (results: SearchResult[]) => {
		for (const result of results) directIds.add(String(result.id));
		return results;
	};

	const strictResults = rememberDirect(index.search(directQuery, {
		...baseOptions, combineWith: 'AND', fuzzy: false, prefix: false
	}));
	mergeResults(ranked, strictResults, 2.05);
	if (strictResults.length === 0) {
		const suggestion = index.autoSuggest(directQuery, {
			...baseOptions,
			combineWith: 'AND',
			fuzzy: 0.34,
			prefix: false
		})[0]?.suggestion;
		if (suggestion && norm(suggestion) !== directQuery) {
			correctedQuery = parseQuery(suggestion);
			mergeResults(ranked, rememberDirect(index.search(suggestion, {
				...baseOptions, combineWith: 'AND', fuzzy: false, prefix: false
			})), 1.72);
		}
	}
	mergeResults(ranked, rememberDirect(index.search(directQuery, {
		...baseOptions, combineWith: 'AND', fuzzy: adaptiveFuzzy, prefix: adaptivePrefix
	})), 1.35);
	mergeResults(ranked, rememberDirect(index.search(directQuery, {
		...baseOptions, combineWith: 'OR', fuzzy: adaptiveFuzzy, prefix: adaptivePrefix
	})), parsed.stems.length > 1 ? 0.62 : 1);

	const expandedTerms = expandSemanticQuery(parsed);
	if (expandedTerms.length > parsed.meaningfulWords.length) {
		mergeResults(ranked, index.search(expandedTerms.join(' '), {
			...baseOptions, combineWith: 'OR', fuzzy: false, prefix: false
		}), 0.26);
	}

	const sorted = [...ranked.values()]
		.map((result) => ({ ...result, score: result.score * signalMultiplier(result, correctedQuery ?? parsed) }))
		.sort((a, b) => b.score - a.score);
	let semanticOnlyCount = 0;
	const semanticOnlyCap = insideSingleReport ? 8 : 16;
	const bounded = sorted.filter((result) => {
		if (directIds.has(String(result.id))) return true;
		semanticOnlyCount += 1;
		return semanticOnlyCount <= semanticOnlyCap;
	});
	return diversify(bounded, limit, insideSingleReport).map((result) => toHit(result, parsed));
}

/** Search the archive. `scopeSlugs` narrows the index to a collection or active facets. */
export async function searchReports(query: string, limit = 40, scopeSlugs?: string[]) {
	const scoped = scopeSlugs?.length ? new Set(scopeSlugs) : null;
	const filter = scoped
		? (result: SearchResult) => scoped.has((result as unknown as IndexedDoc).reportSlug)
		: undefined;
	return executeSearch(query, limit, filter, false);
}

/** Search inside one report, excluding the report-level catalog document. */
export async function searchReport(reportSlug: string, query: string, limit = 40) {
	return executeSearch(
		query,
		limit,
		(result) => {
			const doc = result as unknown as IndexedDoc;
			return doc.reportSlug === reportSlug && doc.zone !== 'reports';
		},
		true
	);
}

/** Warm the prebuilt index on focus without blocking first paint. */
export function preloadSearchIndex(): void {
	void loadIndex();
}

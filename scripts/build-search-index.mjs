/**
 * Builds a compact, ready-to-query MiniSearch index.
 * Transcript segments are grouped into meaningful windows so phrases can span
 * ASR segment boundaries and the browser does not have to index 100k+ tiny docs.
 */
import MiniSearch from 'minisearch';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = join(root, 'src/lib/data/reports');
const transcriptsDir = join(root, 'src/lib/data/transcripts');
const searchDir = join(root, 'static/search');
const staticTranscriptsDir = join(root, 'static/transcripts');
// v4: индекс порезан на два шарда — лёгкое ядро ищется сразу,
// тяжёлые transcript-окна догружаются фоном (см. search-core.ts).
const outCoreIndex = join(searchDir, 'index-core.json');
const outTranscriptIndex = join(searchDir, 'index-transcripts.json');
const legacyIndex = join(searchDir, 'index.json');
const outManifest = join(searchDir, 'manifest.json');
const outChapterTitles = join(searchDir, 'chapter-titles.json');
const outMeta = join(root, 'src/lib/data/report-meta.json');

import { stemRu } from '../src/lib/stem-ru.js';

const INDEX_VERSION = 4;
const TRANSCRIPT_TARGET_CHARS = 620;
const TRANSCRIPT_MAX_CHARS = 920;
const TRANSCRIPT_MAX_SECONDS = 45;
// Сниппет в выдаче ~156 симв.; храним с запасом для центрирования по совпадению.
const STORED_TEXT_MAX_CHARS = 400;

/**
 * В индексе хранится только невычислимое: zone/href/reportTitle и заголовки
 * глав восстанавливаются на клиенте из kind + report-meta (см. search-core.ts).
 * @typedef {{ id: number; kind: string; zone: string; reportSlug: string; reportTitle: string; chapterIndex?: number; start?: number; title?: string; text: string; href: string; field_title: string; field_body: string; field_tags: string; reasonTags?: string }} IndexedDoc
 */

/** @type {IndexedDoc[]} */
const docs = [];
/** @type {Array<{ slug: string; title: string; subtitle: string; tags?: string[]; duration: number; overview_theses: string[]; chapterCount: number; video?: unknown }>} */
const meta = [];
/**
 * Заголовки глав нужны только выдаче поиска — уезжают в ленивый
 * static/search/chapter-titles.json, а не в eager-бандл report-meta.
 * @type {Record<string, string[]>}
 */
const chapterTitlesBySlug = {};
// Карточки показывают максимум 2 тезиса (ReportCard.slice(0, 2)) — остальное не грузим.
const META_THESES_LIMIT = 2;

function norm(value) {
	return String(value ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

let nextDocId = 0;

/** Обрезает сохранённый текст transcript-окна: индексируется всегда полный. */
function storedText(text) {
	if (text.length <= STORED_TEXT_MAX_CHARS) return text;
	const cut = text.slice(0, STORED_TEXT_MAX_CHARS);
	const lastSpace = cut.lastIndexOf(' ');
	return (lastSpace > STORED_TEXT_MAX_CHARS * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

function processTerm(term) {
	const token = norm(term).replace(/[^\p{L}\p{N}]/gu, '');
	return token.length >= 2 ? stemRu(token) : null;
}

function addDoc(doc) {
	// Числовой id: строковые id вида "s:slug:12:3" раздували documentIds (~0.8 MiB).
	docs.push({ ...doc, id: nextDocId++ });
}

function joined(values) {
	return values.filter(Boolean).join(' ');
}

/** Groups adjacent ASR segments into phrase-searchable windows. */
function transcriptWindows(segments) {
	const windows = [];
	let current = [];
	let chars = 0;
	let start = 0;

	const flush = () => {
		if (!current.length) return;
		windows.push({
			start,
			text: current.map((segment) => String(segment.text ?? '').trim()).filter(Boolean).join(' ')
		});
		current = [];
		chars = 0;
	};

	for (const segment of segments) {
		const text = String(segment.text ?? '').trim();
		if (!text) continue;
		if (!current.length) start = Number(segment.start ?? 0);
		const nextChars = chars + text.length + (current.length ? 1 : 0);
		const elapsed = Number(segment.start ?? start) - start;
		if (current.length && (nextChars > TRANSCRIPT_MAX_CHARS || elapsed > TRANSCRIPT_MAX_SECONDS)) {
			flush();
			start = Number(segment.start ?? 0);
		}
		current.push(segment);
		chars += text.length + (current.length > 1 ? 1 : 0);
		if (chars >= TRANSCRIPT_TARGET_CHARS && /[.!?…]$/.test(text)) flush();
	}
	flush();
	return windows;
}

// Публикуемые ассеты расшифровок пересобираются с нуля при каждом прогоне.
rmSync(staticTranscriptsDir, { recursive: true, force: true });
mkdirSync(staticTranscriptsDir, { recursive: true });

/** Возвращает sidecar с сегментами/расшифровкой или null, если его нет. */
function readTranscriptSidecar(slug) {
	const path = join(transcriptsDir, `${slug}.json`);
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, 'utf8'));
}

for (const file of readdirSync(reportsDir).filter((name) => name.endsWith('.json')).sort()) {
	const report = JSON.parse(readFileSync(join(reportsDir, file), 'utf8'));
	const slug = report.slug;
	const common = { reportSlug: slug };
	const sidecar = readTranscriptSidecar(slug);
	if (sidecar?.transcript) {
		writeFileSync(
			join(staticTranscriptsDir, `${slug}.json`),
			JSON.stringify({ transcript: sidecar.transcript })
		);
	}

	meta.push({
		slug,
		title: report.title,
		subtitle: report.subtitle,
		tags: report.tags ?? [],
		duration: report.duration ?? 0,
		overview_theses: (report.overview_theses ?? []).slice(0, META_THESES_LIMIT),
		chapterCount: report.chapters?.length ?? 0,
		...(report.video ? { video: report.video } : {})
	});
	chapterTitlesBySlug[slug] = (report.chapters ?? []).map((chapter) => chapter.title);

	// title не задаём у report/overview/chapter/thesis/transcript-документов:
	// он вычислим на клиенте (report-meta + kind), а undefined-поля MiniSearch не хранит.
	addDoc({
		kind: 'report',
		...common,
		text: report.subtitle ?? '',
		field_title: report.title,
		field_body: joined([report.subtitle, report.source_name, ...(report.overview_theses ?? [])]),
		field_tags: (report.tags ?? []).join(' '),
		reasonTags: (report.tags ?? []).join(' ')
	});

	for (const thesis of report.overview_theses ?? []) {
		addDoc({
			kind: 'overview',
			...common,
			text: thesis,
			field_title: `Главное ${report.title}`,
			field_body: thesis,
			field_tags: ''
		});
	}

	for (const [chapterIndex, chapter] of (report.chapters ?? []).entries()) {
		addDoc({
			kind: 'chapter',
			...common,
			chapterIndex,
			start: chapter.start,
			text: chapter.summary || chapter.title,
			field_title: chapter.title,
			field_body: joined([chapter.title, chapter.summary]),
			field_tags: ''
		});

		for (const thesis of chapter.theses ?? []) {
			addDoc({
				kind: 'thesis',
				...common,
				chapterIndex,
				start: chapter.start,
				text: thesis,
				field_title: chapter.title,
				field_body: thesis,
				field_tags: ''
			});
		}

		const chapterSegments = sidecar?.chapters?.[chapterIndex]?.segments ?? chapter.segments ?? [];
		for (const window of transcriptWindows(chapterSegments)) {
			addDoc({
				kind: 'transcript',
				...common,
				chapterIndex,
				start: window.start,
				text: storedText(window.text),
				field_title: chapter.title,
				field_body: window.text,
				field_tags: ''
			});
		}
	}

	for (const tab of report.focus_tabs ?? []) {
		for (const item of tab.items ?? []) {
			addDoc({
				kind: 'material', ...common, start: item.start,
				title: `${tab.title}: ${item.title}`,
				text: joined([item.summary, ...(item.theses ?? [])]),
				field_title: `${tab.title} ${item.title}`,
				field_body: joined([item.summary, ...(item.theses ?? [])]),
				field_tags: 'дополнительные материалы тематический срез'
			});
		}
	}

	for (const section of report.seminar_exercises ?? []) {
		for (const item of section.items ?? []) {
			addDoc({
				kind: 'material', ...common, start: item.start,
				title: `Упражнения: ${section.title}`, text: item.text,
				field_title: `Упражнения ${section.title}`, field_body: item.text,
				field_tags: 'дополнительные материалы упражнение практика'
			});
		}
	}

	for (const section of report.seminar_notes ?? []) {
		addDoc({
			kind: 'material', ...common,
			title: `Конспект: ${section.title}`, text: (section.items ?? []).join(' '),
			field_title: `Конспект ${section.title}`, field_body: (section.items ?? []).join(' '),
			field_tags: 'дополнительные материалы конспект'
		});
	}

	for (const item of report.glossary ?? []) {
		addDoc({
			kind: 'material', ...common,
			title: `Глоссарий: ${item.term}`, text: item.definition,
			field_title: `Глоссарий ${item.term}`, field_body: item.definition,
			field_tags: 'дополнительные материалы глоссарий термин'
		});
	}

	for (const [title, asset] of [
		['Инфографика', report.infographic],
		['Памятка по упражнениям', report.exercise_memo]
	]) {
		if (!asset) continue;
		addDoc({
			kind: 'material', ...common,
			title, text: asset.alt ?? title,
			field_title: title, field_body: asset.alt ?? '',
			field_tags: 'дополнительные материалы инфографика памятка'
		});
	}
}

const miniSearchOptions = {
	idField: 'id',
	fields: ['field_title', 'field_body', 'field_tags'],
	// zone/href/reportTitle и заголовки глав вычисляются на клиенте — не храним.
	storeFields: ['kind', 'reportSlug', 'chapterIndex', 'start', 'title', 'text', 'reasonTags'],
	processTerm
};

// Ядро (отчёты/главы/тезисы/материалы) мало и парсится мгновенно;
// transcript-окна — ~90% объёма, уезжают в отдельный фоновый шард.
// id глобально уникальны между шардами (общий nextDocId).
const coreDocs = docs.filter((doc) => doc.kind !== 'transcript');
const transcriptDocs = docs.filter((doc) => doc.kind === 'transcript');

function serializeIndex(shardDocs) {
	const search = new MiniSearch(miniSearchOptions);
	search.addAll(shardDocs);
	return JSON.stringify(search);
}

const serializedCore = serializeIndex(coreDocs);
const serializedTranscripts = serializeIndex(transcriptDocs);
const kinds = Object.fromEntries([...new Set(docs.map((doc) => doc.kind))].map((kind) => [kind, docs.filter((doc) => doc.kind === kind).length]));
const reportDocuments = Object.fromEntries(meta.map(({ slug }) => {
	const reportDocs = docs.filter((doc) => doc.reportSlug === slug);
	return [slug, Object.fromEntries([...new Set(reportDocs.map((doc) => doc.kind))].map((kind) => [kind, reportDocs.filter((doc) => doc.kind === kind).length]))];
}));

mkdirSync(searchDir, { recursive: true });
rmSync(legacyIndex, { force: true });
writeFileSync(outCoreIndex, serializedCore);
writeFileSync(outTranscriptIndex, serializedTranscripts);
writeFileSync(outChapterTitles, JSON.stringify(chapterTitlesBySlug));
writeFileSync(outManifest, JSON.stringify({
	version: INDEX_VERSION,
	documents: docs.length,
	reports: meta.length,
	kinds,
	reportDocuments,
	bytes: {
		core: Buffer.byteLength(serializedCore),
		transcripts: Buffer.byteLength(serializedTranscripts)
	}
}, null, '\t') + '\n');
writeFileSync(outMeta, JSON.stringify(meta, null, '\t') + '\n');

const mib = (value) => (value / 1048576).toFixed(2);
console.log(
	`search-index v${INDEX_VERSION}: ${docs.length} docs (core ${coreDocs.length} / transcripts ${transcriptDocs.length}), ` +
	`core ${mib(Buffer.byteLength(serializedCore))} MiB + transcripts ${mib(Buffer.byteLength(serializedTranscripts))} MiB, ${meta.length} reports`
);

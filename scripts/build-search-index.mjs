/**
 * Builds a compact, ready-to-query MiniSearch index.
 * Transcript segments are grouped into meaningful windows so phrases can span
 * ASR segment boundaries and the browser does not have to index 100k+ tiny docs.
 */
import MiniSearch from 'minisearch';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = join(root, 'src/lib/data/reports');
const searchDir = join(root, 'static/search');
const outIndex = join(searchDir, 'index.json');
const outManifest = join(searchDir, 'manifest.json');
const outMeta = join(root, 'src/lib/data/report-meta.json');

const INDEX_VERSION = 2;
const TRANSCRIPT_TARGET_CHARS = 620;
const TRANSCRIPT_MAX_CHARS = 920;
const TRANSCRIPT_MAX_SECONDS = 45;

/** @typedef {{ id: string; kind: string; zone: string; reportSlug: string; reportTitle: string; chapterIndex?: number; start?: number; title: string; text: string; href: string; field_title: string; field_body: string; field_tags: string; reasonTags?: string }} IndexedDoc */

/** @type {IndexedDoc[]} */
const docs = [];
/** @type {Array<{ slug: string; title: string; subtitle: string; tags?: string[]; duration: number; overview_theses: string[]; chapterCount: number; video?: unknown }>} */
const meta = [];

function norm(value) {
	return String(value ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

// Same compact Russian stemmer used by the browser query path.
const RV = /^(.*?[аеиоуыэюя])(.*)$/;
const PERFECTIVE_GERUND = /(ив|ивши|ившись|ыв|ывши|ывшись|(?<=[ая])(?:в|вши|вшись))$/;
const REFLEXIVE = /с[яь]$/;
const ADJECTIVE = /(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/;
const PARTICIPLE = /(ивш|ывш|ующ|(?<=[ая])(?:ем|нн|вш|ющ|щ))$/;
const VERB = /(ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ую|ю|(?<=[ая])(?:ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно))$/;
const NOUN = /(а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|ия|ья|я)$/;
const SUPERLATIVE = /(ейше|ейш)$/;
const DERIVATIONAL = /(ость|ост)$/;

function stemRu(token) {
	const word = norm(token);
	if (!/[а-яё]/.test(word) || word.length < 3) return word;
	const match = RV.exec(word);
	if (!match) return word;
	const head = match[1];
	let rv = match[2];
	const afterGerund = rv.replace(PERFECTIVE_GERUND, '');
	if (afterGerund !== rv) {
		rv = afterGerund;
	} else {
		rv = rv.replace(REFLEXIVE, '');
		const afterAdj = rv.replace(ADJECTIVE, '');
		if (afterAdj !== rv) rv = afterAdj.replace(PARTICIPLE, '');
		else {
			const afterVerb = rv.replace(VERB, '');
			rv = afterVerb !== rv ? afterVerb : rv.replace(NOUN, '');
		}
	}
	rv = rv.replace(/и$/, '').replace(DERIVATIONAL, '');
	if (/нн$/.test(rv)) rv = rv.slice(0, -1);
	else if (SUPERLATIVE.test(rv)) {
		rv = rv.replace(SUPERLATIVE, '');
		if (/нн$/.test(rv)) rv = rv.slice(0, -1);
	} else rv = rv.replace(/ь$/, '');
	return head + rv;
}

function processTerm(term) {
	const token = norm(term).replace(/[^\p{L}\p{N}]/gu, '');
	return token.length >= 2 ? stemRu(token) : null;
}

function addDoc(doc) {
	docs.push(doc);
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

for (const file of readdirSync(reportsDir).filter((name) => name.endsWith('.json')).sort()) {
	const report = JSON.parse(readFileSync(join(reportsDir, file), 'utf8'));
	const slug = report.slug;
	const baseHref = `/reports/${slug}/`;
	const common = { reportSlug: slug, reportTitle: report.title };

	meta.push({
		slug,
		title: report.title,
		subtitle: report.subtitle,
		tags: report.tags ?? [],
		duration: report.duration ?? 0,
		overview_theses: report.overview_theses ?? [],
		chapterCount: report.chapters?.length ?? 0,
		...(report.video ? { video: report.video } : {})
	});

	addDoc({
		id: `r:${slug}`,
		kind: 'report',
		zone: 'reports',
		...common,
		title: report.title,
		text: report.subtitle ?? '',
		href: baseHref,
		field_title: report.title,
		field_body: joined([report.subtitle, report.source_name, ...(report.overview_theses ?? [])]),
		field_tags: (report.tags ?? []).join(' '),
		reasonTags: (report.tags ?? []).join(' ')
	});

	for (const [index, thesis] of (report.overview_theses ?? []).entries()) {
		addDoc({
			id: `o:${slug}:${index}`,
			kind: 'overview',
			zone: 'theses',
			...common,
			title: 'Главное',
			text: thesis,
			href: `${baseHref}#overview-title`,
			field_title: `Главное ${report.title}`,
			field_body: thesis,
			field_tags: ''
		});
	}

	for (const [chapterIndex, chapter] of (report.chapters ?? []).entries()) {
		const chapterHref = `${baseHref}#ch-${chapterIndex + 1}`;
		addDoc({
			id: `c:${slug}:${chapterIndex}`,
			kind: 'chapter',
			zone: 'chapters',
			...common,
			chapterIndex,
			start: chapter.start,
			title: chapter.title,
			text: chapter.summary || chapter.title,
			href: chapterHref,
			field_title: chapter.title,
			field_body: joined([chapter.title, chapter.summary]),
			field_tags: ''
		});

		for (const [index, thesis] of (chapter.theses ?? []).entries()) {
			addDoc({
				id: `t:${slug}:${chapterIndex}:${index}`,
				kind: 'thesis',
				zone: 'theses',
				...common,
				chapterIndex,
				start: chapter.start,
				title: chapter.title,
				text: thesis,
				href: chapterHref,
				field_title: chapter.title,
				field_body: thesis,
				field_tags: ''
			});
		}

		for (const [index, window] of transcriptWindows(chapter.segments ?? []).entries()) {
			addDoc({
				id: `s:${slug}:${chapterIndex}:${index}`,
				kind: 'transcript',
				zone: 'transcript',
				...common,
				chapterIndex,
				start: window.start,
				title: chapter.title,
				text: window.text,
				href: chapterHref,
				field_title: chapter.title,
				field_body: window.text,
				field_tags: ''
			});
		}
	}

	const additionalHref = `${baseHref}#additional-title`;
	for (const tab of report.focus_tabs ?? []) {
		for (const [index, item] of (tab.items ?? []).entries()) {
			addDoc({
				id: `m:${slug}:focus:${tab.id}:${index}`,
				kind: 'material', zone: 'additional', ...common, start: item.start,
				title: `${tab.title}: ${item.title}`,
				text: joined([item.summary, ...(item.theses ?? [])]), href: additionalHref,
				field_title: `${tab.title} ${item.title}`,
				field_body: joined([item.summary, ...(item.theses ?? [])]),
				field_tags: 'дополнительные материалы тематический срез'
			});
		}
	}

	for (const [sectionIndex, section] of (report.seminar_exercises ?? []).entries()) {
		for (const [index, item] of (section.items ?? []).entries()) {
			addDoc({
				id: `m:${slug}:exercise:${sectionIndex}:${index}`,
				kind: 'material', zone: 'additional', ...common, start: item.start,
				title: `Упражнения: ${section.title}`, text: item.text, href: additionalHref,
				field_title: `Упражнения ${section.title}`, field_body: item.text,
				field_tags: 'дополнительные материалы упражнение практика'
			});
		}
	}

	for (const [index, section] of (report.seminar_notes ?? []).entries()) {
		addDoc({
			id: `m:${slug}:notes:${index}`, kind: 'material', zone: 'additional', ...common,
			title: `Конспект: ${section.title}`, text: (section.items ?? []).join(' '), href: additionalHref,
			field_title: `Конспект ${section.title}`, field_body: (section.items ?? []).join(' '),
			field_tags: 'дополнительные материалы конспект'
		});
	}

	for (const [index, item] of (report.glossary ?? []).entries()) {
		addDoc({
			id: `m:${slug}:glossary:${index}`, kind: 'material', zone: 'additional', ...common,
			title: `Глоссарий: ${item.term}`, text: item.definition, href: additionalHref,
			field_title: `Глоссарий ${item.term}`, field_body: item.definition,
			field_tags: 'дополнительные материалы глоссарий термин'
		});
	}

	for (const [id, title, asset] of [
		['infographic', 'Инфографика', report.infographic],
		['exercise-memo', 'Памятка по упражнениям', report.exercise_memo]
	]) {
		if (!asset) continue;
		addDoc({
			id: `m:${slug}:${id}`, kind: 'material', zone: 'additional', ...common,
			title, text: asset.alt ?? title, href: additionalHref,
			field_title: title, field_body: asset.alt ?? '',
				field_tags: 'дополнительные материалы инфографика памятка'
		});
	}
}

const miniSearchOptions = {
	idField: 'id',
	fields: ['field_title', 'field_body', 'field_tags'],
	storeFields: ['kind', 'zone', 'reportSlug', 'reportTitle', 'chapterIndex', 'start', 'title', 'text', 'href', 'reasonTags'],
	processTerm
};
const search = new MiniSearch(miniSearchOptions);
search.addAll(docs);
const serializedIndex = JSON.stringify(search);
const kinds = Object.fromEntries([...new Set(docs.map((doc) => doc.kind))].map((kind) => [kind, docs.filter((doc) => doc.kind === kind).length]));
const reportDocuments = Object.fromEntries(meta.map(({ slug }) => {
	const reportDocs = docs.filter((doc) => doc.reportSlug === slug);
	return [slug, Object.fromEntries([...new Set(reportDocs.map((doc) => doc.kind))].map((kind) => [kind, reportDocs.filter((doc) => doc.kind === kind).length]))];
}));

mkdirSync(searchDir, { recursive: true });
writeFileSync(outIndex, serializedIndex);
writeFileSync(outManifest, JSON.stringify({
	version: INDEX_VERSION,
	documents: docs.length,
	reports: meta.length,
	kinds,
	reportDocuments,
	bytes: Buffer.byteLength(serializedIndex)
}, null, '\t') + '\n');
writeFileSync(outMeta, JSON.stringify(meta, null, '\t') + '\n');

console.log(`search-index v${INDEX_VERSION}: ${docs.length} docs, ${(Buffer.byteLength(serializedIndex) / 1048576).toFixed(2)} MiB, ${meta.length} reports`);

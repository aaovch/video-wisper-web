/**
 * Лёгкий индекс для поиска и карточек (без полных транскриптов в клиентском бандле).
 * Запуск: node scripts/build-search-index.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = join(root, 'src/lib/data/reports');
const outIndex = join(root, 'src/lib/data/search-index.json');
const outMeta = join(root, 'src/lib/data/report-meta.json');

/** @typedef {{ id: string; kind: string; reportSlug: string; reportTitle: string; chapterIndex?: number; start?: number; title: string; text: string; href: string; field_title: string; field_body: string; field_tags: string }} IndexedDoc */

/** @type {IndexedDoc[]} */
const docs = [];
/** @type {Array<{ slug: string; title: string; subtitle: string; duration: number; overview_theses: string[]; chapterCount: number; video?: unknown }>} */
const meta = [];

for (const file of readdirSync(reportsDir).filter((f) => f.endsWith('.json')).sort()) {
	const report = JSON.parse(readFileSync(join(reportsDir, file), 'utf8'));
	const slug = report.slug;
	const baseHref = `/reports/${slug}/`;
	const common = { reportSlug: slug, reportTitle: report.title };

	meta.push({
		slug,
		title: report.title,
		subtitle: report.subtitle,
		duration: report.duration ?? 0,
		overview_theses: report.overview_theses ?? [],
		chapterCount: report.chapters?.length ?? 0,
		...(report.video ? { video: report.video } : {})
	});

	docs.push({
		id: `r:${slug}`,
		kind: 'report',
		...common,
		title: report.title,
		text: report.subtitle ?? '',
		href: baseHref,
		field_title: report.title,
		field_body: [report.subtitle, report.source_name].filter(Boolean).join(' '),
		field_tags: (report.tags ?? []).join(' ')
	});

	for (const [ci, ch] of (report.chapters ?? []).entries()) {
		const chHref = `${baseHref}#ch-${ci + 1}`;
		docs.push({
			id: `c:${slug}:${ci}`,
			kind: 'chapter',
			...common,
			chapterIndex: ci,
			start: ch.start,
			title: ch.title,
			text: ch.summary || ch.title,
			href: chHref,
			field_title: ch.title,
			field_body: [ch.title, ch.summary, ...(ch.theses ?? [])].filter(Boolean).join(' '),
			field_tags: ''
		});

		for (const [i, seg] of (ch.segments ?? []).entries()) {
			docs.push({
				id: `s:${slug}:${ci}:${i}`,
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
		}
	}
}

writeFileSync(outIndex, JSON.stringify(docs));
writeFileSync(outMeta, JSON.stringify(meta, null, '\t') + '\n');
console.log(`search-index: ${docs.length} docs, report-meta: ${meta.length} reports`);

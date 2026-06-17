import { reports } from '$lib/data';
import type { Report } from '$lib/types';

export type SearchHitKind = 'report' | 'chapter' | 'thesis' | 'transcript';

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

function norm(s: string): string {
	return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function snippet(text: string, q: string, max = 88): string {
	const i = norm(text).indexOf(norm(q));
	if (i < 0) return text.slice(0, max) + (text.length > max ? '…' : '');
	const start = Math.max(0, i - 24);
	const end = Math.min(text.length, i + q.length + 48);
	const chunk = text.slice(start, end).trim();
	return (start > 0 ? '…' : '') + chunk + (end < text.length ? '…' : '');
}

function pushChapterHits(
	hits: SearchHit[],
	report: Report,
	query: string,
	chapterIndex: number,
	baseHref: string
) {
	const ch = report.chapters[chapterIndex];
	const q = norm(query);
	const chHay = norm([ch.title, ch.summary, ...ch.theses].join(' '));
	if (chHay.includes(q)) {
		const titleMatch = norm(ch.title).includes(q);
		hits.push({
			kind: 'chapter',
			reportSlug: report.slug,
			reportTitle: report.title,
			chapterIndex,
			title: ch.title,
			snippet: snippet(ch.summary, query),
			href: `${baseHref}#ch-${chapterIndex + 1}`,
			start: ch.start,
			score: titleMatch ? 90 : 60
		});
	}

	for (const seg of ch.segments ?? []) {
		if (!norm(seg.text).includes(q)) continue;
		hits.push({
			kind: 'transcript',
			reportSlug: report.slug,
			reportTitle: report.title,
			chapterIndex,
			title: ch.title,
			snippet: snippet(seg.text, query),
			href: `${baseHref}#ch-${chapterIndex + 1}`,
			start: seg.start,
			score: 45
		});
	}
}

/** Поиск внутри одного отчёта: блоки, тезисы, фразы транскрипта. */
export function searchReport(report: Report, query: string, limit = 14): SearchHit[] {
	const q = norm(query);
	if (q.length < 2) return [];

	const hits: SearchHit[] = [];
	const baseHref = `/reports/${report.slug}/`;

	for (const thesis of report.overview_theses) {
		if (!norm(thesis).includes(q)) continue;
		hits.push({
			kind: 'thesis',
			reportSlug: report.slug,
			reportTitle: report.title,
			title: 'Главный тезис',
			snippet: snippet(thesis, query),
			href: baseHref,
			score: 55
		});
	}

	report.chapters.forEach((_, i) => pushChapterHits(hits, report, query, i, baseHref));

	return dedupeAndSort(hits, limit);
}

/** Поиск по архиву. По умолчанию — все отчёты; можно сузить до подмножества (коллекции). */
export function searchReports(query: string, limit = 12, source: Report[] = reports): SearchHit[] {
	const q = norm(query);
	if (q.length < 2) return [];

	const hits: SearchHit[] = [];

	for (const report of source) {
		const baseHref = `/reports/${report.slug}/`;

		const reportHay = norm(
			[report.title, report.subtitle, report.source_name, ...report.tags].join(' ')
		);
		if (reportHay.includes(q)) {
			hits.push({
				kind: 'report',
				reportSlug: report.slug,
				reportTitle: report.title,
				title: report.title,
				snippet: report.subtitle,
				href: baseHref,
				score: norm(report.title).includes(q) ? 100 : 70
			});
		}

		for (const thesis of report.overview_theses) {
			if (!norm(thesis).includes(q)) continue;
			hits.push({
				kind: 'thesis',
				reportSlug: report.slug,
				reportTitle: report.title,
				title: 'Главный тезис',
				snippet: snippet(thesis, query),
				href: baseHref,
				score: 55
			});
		}

		report.chapters.forEach((_, i) => pushChapterHits(hits, report, query, i, baseHref));
	}

	return dedupeAndSort(hits, limit);
}

function dedupeAndSort(hits: SearchHit[], limit: number): SearchHit[] {
	const seen = new Set<string>();
	const unique: SearchHit[] = [];

	for (const hit of hits.sort(
		(a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ru')
	)) {
		const key = `${hit.kind}|${hit.href}|${hit.start ?? ''}|${hit.snippet}`;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(hit);
		if (unique.length >= limit) break;
	}

	return unique;
}

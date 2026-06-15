import { reports } from '$lib/data';

export type SearchHitKind = 'report' | 'chapter' | 'thesis';

export interface SearchHit {
	kind: SearchHitKind;
	reportSlug: string;
	reportTitle: string;
	title: string;
	snippet: string;
	/** Якорь блока, напр. #ch-3 */
	href: string;
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

/** Поиск по записям, блокам и тезисам (простой substring, без fuzzy). */
export function searchReports(query: string, limit = 12): SearchHit[] {
	const q = norm(query);
	if (q.length < 2) return [];

	const hits: SearchHit[] = [];

	for (const report of reports) {
		const baseHref = `/reports/${report.slug}/`;

		const reportHay = norm(
			[report.title, report.subtitle, report.source_name, ...report.tags, report.transcript ?? ''].join(' ')
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
			if (norm(thesis).includes(q)) {
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
		}

		report.chapters.forEach((ch, i) => {
			const chHay = norm([ch.title, ch.summary, ...ch.theses].join(' '));
			if (!chHay.includes(q)) return;
			const titleMatch = norm(ch.title).includes(q);
			hits.push({
				kind: 'chapter',
				reportSlug: report.slug,
				reportTitle: report.title,
				title: ch.title,
				snippet: snippet(ch.summary, query),
				href: `${baseHref}#ch-${i + 1}`,
				score: titleMatch ? 90 : 60
			});
		});
	}

	return hits
		.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ru'))
		.slice(0, limit);
}

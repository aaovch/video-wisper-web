import type { ChapterGroup, ReportGroup, SearchHit } from '$lib/search-types';

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

export function groupByChapter(hits: SearchHit[], perGroup = 5): ChapterGroup[] {
	const groups = new Map<string, ChapterGroup>();

	for (const hit of hits) {
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

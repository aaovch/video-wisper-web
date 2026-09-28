import type { SearchHit } from './search-types';

export function fragmentAnchor(hit: SearchHit): string {
	if (hit.chapterIndex != null) return `ch-${hit.chapterIndex + 1}`;
	if (hit.zone === 'theses') return 'overview-title';
	if (hit.kind === 'material' && hit.href.includes('#exercise-')) return hit.href.split('#')[1];
	if (hit.zone === 'additional') return 'additional-title';
	return hit.href.split('#')[1] ?? '';
}

/** Count destinations the reader can visit, not duplicate index hits or individual words. */
export function reportSearchFragments(hits: SearchHit[], reportSlug: string): SearchHit[] {
	const byAnchor = new Map<string, SearchHit>();
	for (const hit of hits) {
		const anchor = fragmentAnchor(hit);
		if (hit.reportSlug === reportSlug && anchor && !byAnchor.has(anchor)) byAnchor.set(anchor, hit);
	}
	return [...byAnchor.values()].sort((a, b) => {
		// A representative passage timestamp may differ from its chapter's start.
		const section = (hit: SearchHit) => hit.chapterIndex != null ? 2 : hit.zone === 'theses' ? 0 : hit.zone === 'additional' ? 1 : 3;
		const sectionDifference = section(a) - section(b);
		if (sectionDifference) return sectionDifference;
		if (a.chapterIndex != null && b.chapterIndex != null) return a.chapterIndex - b.chapterIndex;
		if (a.zone === 'additional' && b.zone === 'additional') return (a.start ?? 0) - (b.start ?? 0);
		return 0;
	});
}

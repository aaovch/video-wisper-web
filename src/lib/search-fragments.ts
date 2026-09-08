import type { SearchHit } from './search-types';

export function fragmentAnchor(hit: SearchHit): string {
	if (hit.chapterIndex != null) return `ch-${hit.chapterIndex + 1}`;
	if (hit.zone === 'theses') return 'overview-title';
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
		const order = (hit: SearchHit) => hit.chapterIndex != null ? hit.chapterIndex : hit.zone === 'theses' ? -2 : hit.zone === 'additional' ? -1 : Number.MAX_SAFE_INTEGER;
		return order(a) - order(b);
	});
}

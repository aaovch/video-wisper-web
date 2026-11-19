import type { SearchHit } from './search-types';

/** The displayed destination, not merely a shared section title. */
export function searchHitKey(hit: SearchHit): string {
	if (hit.chapterIndex != null) return JSON.stringify([hit.reportSlug, 'chapter', hit.chapterIndex]);
	if (hit.kind === 'overview' || hit.kind === 'report') return JSON.stringify([hit.reportSlug, hit.kind]);
	return JSON.stringify([hit.reportSlug, hit.kind, hit.zone, hit.title, hit.start ?? null, hit.href]);
}

/** Keep the highest-ranked representative of each displayed destination. */
export function uniqueSearchHits(hits: SearchHit[]): SearchHit[] {
	const seen = new Set<string>();
	return hits.filter(hit => {
		const key = searchHitKey(hit);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

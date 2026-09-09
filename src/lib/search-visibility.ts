import { collections, reportGate } from '$lib/data/collections';
import { getAllReportSummaries } from '$lib/data/report-meta';

/** Reports visible in search for the current set of unlocked client-side collections. */
export function searchableReportSlugs(unlockedCollectionSlugs: readonly string[], area: 'main' | 'archive' | 'all' = 'main'): string[] {
	const unlocked = new Set(unlockedCollectionSlugs);
	return getAllReportSummaries()
		.map((report) => report.slug)
		.filter((slug) => {
			const memberships = collections.filter((collection) => collection.items.includes(slug));
			const archived = memberships.some((collection) => collection.archived);
			if (area === 'main' && archived) return false;
			if (area === 'archive' && !archived) return false;
			const gate = reportGate(slug);
			return gate.length === 0 || gate.some((target) => unlocked.has(target.slug));
		});
}

export function visibleSubset(slugs: readonly string[], visibleSlugs: readonly string[]): string[] {
	const visible = new Set(visibleSlugs);
	return [...new Set(slugs)].filter((slug) => visible.has(slug));
}

import { collections } from '$lib/data/collections';
import { getAllReportSummaries } from '$lib/data/report-meta';

/** Reports visible in search for the current set of unlocked client-side collections. */
export function searchableReportSlugs(unlockedCollectionSlugs: readonly string[]): string[] {
	const unlocked = new Set(unlockedCollectionSlugs);
	return getAllReportSummaries()
		.map((report) => report.slug)
		.filter((slug) => {
			const memberships = collections.filter((collection) => collection.items.includes(slug));
			if (memberships.length === 0 || memberships.some((collection) => !collection.password)) return true;
			return memberships.some((collection) => unlocked.has(collection.slug));
		});
}

export function visibleSubset(slugs: readonly string[], visibleSlugs: readonly string[]): string[] {
	const visible = new Set(visibleSlugs);
	return [...new Set(slugs)].filter((slug) => visible.has(slug));
}

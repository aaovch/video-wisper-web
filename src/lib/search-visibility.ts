import { collections, reportGate } from '$lib/data/collections';
import { getAllReportSummaries } from '$lib/data/report-meta';

export type SearchArea = 'main' | 'archive' | 'all';

/** Reports that belong to an area, including password-protected catalog entries. */
export function catalogReportSlugs(area: SearchArea = 'main'): string[] {
	return getAllReportSummaries()
		.map((report) => report.slug)
		.filter((slug) => {
			const memberships = collections.filter((collection) => collection.items.includes(slug));
			const archived = memberships.some((collection) => collection.archived);
			if (area === 'main' && archived) return false;
			if (area === 'archive' && !archived) return false;
			return true;
		});
}

/** Whether a report still requires one of its client-side access targets. */
export function isReportLocked(slug: string, unlockedTargetSlugs: readonly string[]): boolean {
	const unlocked = new Set(unlockedTargetSlugs);
	const gate = reportGate(slug);
	return gate.length > 0 && !gate.some((target) => unlocked.has(target.slug));
}

/** Reports whose content can be shown for the current set of unlocked access targets. */
export function searchableReportSlugs(unlockedCollectionSlugs: readonly string[], area: SearchArea = 'main'): string[] {
	const unlocked = new Set(unlockedCollectionSlugs);
	return catalogReportSlugs(area)
		.filter((slug) => {
			const gate = reportGate(slug);
			return gate.length === 0 || gate.some((target) => unlocked.has(target.slug));
		});
}

export function visibleSubset(slugs: readonly string[], visibleSlugs: readonly string[]): string[] {
	const visible = new Set(visibleSlugs);
	return [...new Set(slugs)].filter((slug) => visible.has(slug));
}

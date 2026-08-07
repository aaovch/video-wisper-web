import { ensureVisitCount, bumpVisitCount } from '$lib/visit-counter.svelte';
import { reportSlugFromPath, trackVisit } from '$lib/visit-counter';
import { recordRecentReport } from '$lib/recent-reports';

/** Учёт визита текущей страницы — один раз за навигацию, вне UI-компонентов. */
export async function trackPageVisit(pathname: string): Promise<void> {
	try {
		const recentSlug = reportSlugFromPath(pathname);
		if (recentSlug) recordRecentReport(recentSlug);

		await trackVisit({ kind: 'site' });
		bumpVisitCount({ kind: 'site' });
		void ensureVisitCount({ kind: 'site' });

		const slug = reportSlugFromPath(pathname);
		if (slug) {
			await trackVisit({ kind: 'report', slug });
			bumpVisitCount({ kind: 'report', slug });
			void ensureVisitCount({ kind: 'report', slug });
		}
	} catch {
		// Счётчик не должен ломать навигацию.
	}
}

import { ensureVisitCount, bumpVisitCount } from '$lib/visit-counter.svelte';
import { reportSlugFromPath, trackVisit } from '$lib/visit-counter';

/** Учёт визита текущей страницы — один раз за навигацию, вне UI-компонентов. */
export async function trackPageVisit(pathname: string): Promise<void> {
	try {
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

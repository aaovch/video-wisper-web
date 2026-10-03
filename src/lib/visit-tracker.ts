import { reportSlugFromPath } from '$lib/visit-counter';
import { recordRecentReport } from '$lib/recent-reports';
import { trackGoatcounter } from '$lib/goatcounter';

/** Учёт визита текущей страницы — один раз за навигацию, вне UI-компонентов. */
export async function trackPageVisit(url: URL, title: string): Promise<void> {
	try {
		const recentSlug = reportSlugFromPath(url.pathname);
		if (recentSlug) recordRecentReport(recentSlug);
		await trackGoatcounter(url, title);
	} catch {
		// Счётчик не должен ломать навигацию.
	}
}

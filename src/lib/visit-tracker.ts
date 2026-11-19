import { reportSlugFromPath } from '$lib/visit-counter';
import { recordRecentReport } from '$lib/recent-reports';
import { trackGoatcounter } from '$lib/goatcounter';
import { communityArchive } from '$lib/site';
import { isReportLocked } from '$lib/search-visibility';
import { lock } from '$lib/lock.svelte';
import { waitForVisibleVisit } from '$lib/visible-visit';

let currentPath: string | undefined;
let cancelPending: (() => void) | undefined;

/** Учёт визита текущей страницы — один раз за навигацию, вне UI-компонентов. */
export async function trackPageVisit(url: URL, title: string): Promise<void> {
	try {
		const recentSlug = reportSlugFromPath(url.pathname);
		if (recentSlug) recordRecentReport(recentSlug);
		if (communityArchive) {
			// Query/hash changes inside a recording are not new openings.
			if (currentPath === url.pathname) return;
			currentPath = url.pathname;
			cancelPending?.();
			cancelPending = undefined;
			if (recentSlug && !isReportLocked(recentSlug, lock.unlocked)) {
				cancelPending = waitForVisibleVisit(() => {
					cancelPending = undefined;
					void fetch('/api/visits', {
						method: 'POST', headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ slug: recentSlug }), keepalive: true
					}).catch(() => {});
				});
			}
		} else {
			await trackGoatcounter(url, title);
		}
	} catch {
		// Счётчик не должен ломать навигацию.
	}
}

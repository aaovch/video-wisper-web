import { browser, dev } from '$app/environment';
import { analyticsPath, analyticsReferrer } from './analytics';

export const GOATCOUNTER_URL = 'https://video-wisper.goatcounter.com';
type CountData = { path: string; title: string; referrer: string };
type Counter = { count: (data: CountData) => void; filter: () => string | false; get_data: (data: CountData) => Record<string, unknown> };
let loading: Promise<Counter | undefined> | undefined;
let lastPath: string | undefined;

function loadCounter(): Promise<Counter | undefined> {
	if (loading) return loading;
	loading = new Promise((resolve) => {
		const script = document.createElement('script');
		script.src = 'https://gc.zgo.at/count.js';
		script.async = true;
		script.dataset.goatcounter = `${GOATCOUNTER_URL}/count`;
		script.dataset.goatcounterSettings = JSON.stringify({ no_onload: true, no_events: true });
		const timer = setTimeout(() => { script.remove(); loading = undefined; resolve(undefined); }, 10000);
		script.onload = () => {
			clearTimeout(timer);
			const counter = (window as unknown as { goatcounter?: Counter }).goatcounter;
			if (!counter?.get_data) { script.remove(); loading = undefined; resolve(undefined); return; }
			// The official script includes location.search separately from path.
			// Never send searches or access parameters to analytics.
			const getData = counter.get_data.bind(counter);
			counter.get_data = data => ({ ...getData(data), q: '' });
			resolve(counter);
		};
		script.onerror = () => { clearTimeout(timer); script.remove(); loading = undefined; resolve(undefined); };
		document.head.append(script);
	});
	return loading;
}

export async function trackGoatcounter(url: URL, title: string): Promise<void> {
	if (!browser || dev || url.hostname !== 'aaovch.github.io' || !/^\/video-wisper-web(?:\/|$)/.test(url.pathname)) return;
	const path = analyticsPath(url.pathname);
	if (path === lastPath) return;
	// Reserve before the script loads so concurrent navigations keep their order.
	lastPath = path;
	const referrer = analyticsReferrer(url, document.referrer);
	try {
		const counter = await loadCounter();
		if (!counter) { if (lastPath === path) lastPath = undefined; return; }
		if (!counter.filter()) counter.count({ path, title, referrer });
	} catch { /* Analytics must not interrupt navigation. */ }
}

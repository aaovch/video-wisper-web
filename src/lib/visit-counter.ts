import { base } from '$app/paths';
import { dev } from '$app/environment';

const API_BASE = 'https://page-views-api.ratneshc.com/api/v1';

export type CounterTarget =
	| { kind: 'site' }
	| { kind: 'report'; slug: string }
	| { kind: 'collection'; slug: string };

function normalizePath(path: string): string {
	let p = path.replace(/\/{2,}/g, '/');
	if (!p.startsWith('/')) p = `/${p}`;
	if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
	return p || '/';
}

export function counterKey(target: CounterTarget): { site: string; path: string } {
	const site = dev ? 'localhost.dev' : 'aaovch.github.io';

	let path: string;
	switch (target.kind) {
		case 'site':
			path = base || '/';
			break;
		case 'report':
			path = `${base}/reports/${target.slug}`;
			break;
		case 'collection':
			path = `${base}/collections/${target.slug}`;
			break;
	}

	return { site, path: normalizePath(path) };
}

/** Текущий URL совпадает со страницей счётчика (для site — всегда). */
export function isCounterPage(target: CounterTarget, pathname: string): boolean {
	if (target.kind === 'site') return true;
	return normalizePath(pathname) === counterKey(target).path;
}

function counterUrl(endpoint: 'track' | 'views', target: CounterTarget): string {
	const params = new URLSearchParams(counterKey(target));
	return `${API_BASE}/${endpoint}?${params}`;
}

/** Учесть визит (дедупликация на стороне API — раз в 30 мин на посетителя). */
export async function trackVisit(target: CounterTarget): Promise<void> {
	await fetch(counterUrl('track', target), { keepalive: true });
}

/** Текущее значение счётчика. */
export async function fetchVisitCount(target: CounterTarget): Promise<number> {
	const res = await fetch(counterUrl('views', target));
	if (!res.ok) throw new Error(`visit count ${res.status}`);
	const data = (await res.json()) as { views?: number };
	if (typeof data.views !== 'number') throw new Error('visit count: bad response');
	return data.views;
}

export function formatVisitCount(n: number): string {
	return new Intl.NumberFormat('ru-RU').format(n);
}

import { base } from '$app/paths';
import { dev } from '$app/environment';

const API_BASE = 'https://page-views-api.ratneshc.com/api/v1';

export type CounterTarget =
	| { kind: 'site' }
	| { kind: 'report'; slug: string }
	| { kind: 'reports-sum'; slugs: string[] };

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
		case 'reports-sum':
			throw new Error('reports-sum has no single counter path');
	}

	return { site, path: normalizePath(path) };
}

/** Стабильный ключ для кэша (reports-sum не кэшируется отдельно). */
export function targetCacheKey(target: CounterTarget): string {
	switch (target.kind) {
		case 'site':
			return 'site';
		case 'report':
			return `report:${target.slug}`;
		case 'reports-sum':
			return `sum:${[...target.slugs].sort().join(',')}`;
	}
}

function counterUrl(endpoint: 'track' | 'views', target: CounterTarget): string {
	const params = new URLSearchParams(counterKey(target));
	return `${API_BASE}/${endpoint}?${params}`;
}

/** Учесть визит (дедупликация на стороне API — раз в 30 мин на посетителя). */
export async function trackVisit(target: CounterTarget): Promise<void> {
	if (target.kind === 'reports-sum') return;
	await fetch(counterUrl('track', target), { keepalive: true });
}

/** Запрос к API без кэша. */
export async function fetchVisitCount(target: CounterTarget): Promise<number> {
	if (target.kind === 'reports-sum') {
		if (!target.slugs.length) return 0;
		const counts = await Promise.all(
			target.slugs.map((slug) => fetchVisitCount({ kind: 'report', slug }))
		);
		return counts.reduce((sum, n) => sum + n, 0);
	}

	const res = await fetch(counterUrl('views', target));
	if (!res.ok) throw new Error(`visit count ${res.status}`);
	const data = (await res.json()) as { views?: number };
	if (typeof data.views !== 'number') throw new Error('visit count: bad response');
	return data.views;
}

export function formatVisitCount(n: number): string {
	return new Intl.NumberFormat('ru-RU').format(n);
}

/** Slug отчёта из pathname с учётом base. */
export function reportSlugFromPath(pathname: string): string | null {
	const prefix = normalizePath(`${base}/reports`);
	if (normalizePath(pathname) === prefix) return null;
	const match = normalizePath(pathname).match(new RegExp(`^${escapeRegExp(prefix)}/([^/]+)`));
	return match?.[1] ?? null;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

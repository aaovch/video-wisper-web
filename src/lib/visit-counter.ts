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

/** Текущий URL совпадает со страницей счётчика (для site — всегда). */
export function isCounterPage(target: CounterTarget, pathname: string): boolean {
	if (target.kind === 'site') return true;
	if (target.kind === 'reports-sum') return false;
	return normalizePath(pathname) === counterKey(target).path;
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

/** Текущее значение счётчика. Для reports-sum — сумма просмотров отчётов. */
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

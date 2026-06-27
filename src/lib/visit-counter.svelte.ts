import {
	type CounterTarget,
	fetchVisitCount,
	targetCacheKey
} from '$lib/visit-counter';

/** Общий кэш — один апдейт, все компоненты с тем же ключом обновляются разом. */
export const visitCache = $state<Record<string, number>>({});

const inflight = new Map<string, Promise<number>>();

export function getVisitCount(target: CounterTarget): number | undefined {
	if (target.kind === 'reports-sum') {
		if (!target.slugs.length) return 0;
		let sum = 0;
		for (const slug of target.slugs) {
			const part = visitCache[`report:${slug}`];
			if (part === undefined) return undefined;
			sum += part;
		}
		return sum;
	}
	return visitCache[targetCacheKey(target)];
}

export async function ensureVisitCount(target: CounterTarget): Promise<number> {
	if (target.kind === 'reports-sum') {
		await Promise.all(
			target.slugs.map((slug) => ensureVisitCount({ kind: 'report', slug }))
		);
		return getVisitCount(target) ?? 0;
	}

	const key = targetCacheKey(target);
	if (key in visitCache) return visitCache[key];

	let pending = inflight.get(key);
	if (!pending) {
		pending = fetchVisitCount(target).then((n) => {
			visitCache[key] = n;
			inflight.delete(key);
			return n;
		});
		inflight.set(key, pending);
	}
	return pending;
}

export function invalidateVisitCount(target: CounterTarget): void {
	if (target.kind === 'reports-sum') return;
	delete visitCache[targetCacheKey(target)];
}

export function prefetchReportCounts(slugs: string[]): void {
	for (const slug of slugs) {
		void ensureVisitCount({ kind: 'report', slug });
	}
}

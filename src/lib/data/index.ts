import type { Report } from '$lib/types';

const loaders = import.meta.glob<Report>('./reports/*.json');

export function getSlugs(): string[] {
	return Object.keys(loaders)
		.map((path) => path.slice('./reports/'.length, -'.json'.length))
		.sort();
}

export async function getReport(slug: string): Promise<Report | undefined> {
	const load = loaders[`./reports/${slug}.json`];
	if (!load) return undefined;
	const mod = await load();
	return (mod as { default?: Report }).default ?? mod;
}

/** Число отчётов (без загрузки JSON). */
export function getReportCount(): number {
	return getSlugs().length;
}

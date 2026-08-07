import { browser } from '$app/environment';

const KEY = 'recent-reports';
const LIMIT = 8;

/** Список недавно открытых отчётов — только на этом устройстве. */
export function readRecentReports(): string[] {
	if (!browser) return [];
	try {
		const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [];
	} catch {
		return [];
	}
}

export function recordRecentReport(slug: string): void {
	if (!browser) return;
	try {
		const list = [slug, ...readRecentReports().filter((s) => s !== slug)];
		localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
	} catch {
		// приватный режим/квота — просто не запоминаем
	}
}

/** Canonical paths never contain search queries, fragment anchors or access keys. */
export function analyticsPath(pathname: string): string {
	return pathname.split(/[?#]/, 1)[0].replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
}

export function analyticsReferrer(url: URL, referrer: string): string {
	const campaign = url.searchParams.get('utm_source');
	if (campaign && /^[\w.-]{1,80}$/.test(campaign)) return `campaign:${campaign}`;
	try { return referrer ? new URL(referrer).origin : ''; } catch { return ''; }
}

export type AnalyticsSnapshot = {
	version: 1;
	generatedAt: string;
	startDate: string;
	endDate: string;
	timezone: string;
	rows: { slug: string; visits: number; daily: { day: string; visits: number }[] }[];
};

export function parseSnapshot(value: unknown): AnalyticsSnapshot {
	const data = value as AnalyticsSnapshot;
	const isDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(`${day}T00:00:00Z`).toISOString().slice(0,10) === day;
	if (data?.version !== 1 || !Number.isFinite(Date.parse(data.generatedAt)) ||
		!isDay(data.startDate) || !isDay(data.endDate) || data.timezone !== 'Asia/Qyzylorda' ||
		data.startDate > data.endDate || !Array.isArray(data.rows)) throw new Error('Invalid analytics snapshot');
	const slugs = new Set<string>();
	for (const row of data.rows) {
		if (!/^[a-z0-9-]+$/.test(row.slug) || slugs.has(row.slug) || !Number.isSafeInteger(row.visits) || row.visits < 0 || !Array.isArray(row.daily))
			throw new Error('Invalid analytics row');
		slugs.add(row.slug);
		const days = new Set<string>();
		for (const item of row.daily) {
			if (!isDay(item.day) || item.day < data.startDate || item.day > data.endDate ||
				days.has(item.day) || !Number.isSafeInteger(item.visits) || item.visits < 0) throw new Error('Invalid daily count');
			days.add(item.day);
		}
		if (row.daily.reduce((sum,item) => sum+item.visits,0) !== row.visits) throw new Error('Inconsistent daily counts');
	}
	return data;
}

export function periodStart(end: string, days: number): string {
	const date = new Date(`${end}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() - days + 1);
	return date.toISOString().slice(0, 10);
}

export function periodVisits(row: AnalyticsSnapshot['rows'][number] | undefined, from: string, to: string): number | null {
	if (!row) return null;
	return row.daily.filter((item) => item.day >= from && item.day <= to).reduce((sum, item) => sum + item.visits, 0);
}

export function csvCell(value: string | number): string {
	const text = String(value);
	// Spreadsheet applications must not execute report titles as formulas.
	return `"${(/^[=+@-]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
}

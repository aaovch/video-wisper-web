import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function publicSlugs(reports, collections) {
	const visible = new Set(collections.filter(c => !c.catalogHidden && !c.isolated).flatMap(c => c.items));
	return reports.map(r => r.slug).filter(slug => visible.has(slug));
}

export async function readTimezone(url, token, fetcher = fetch) {
	const response = await fetcher(`${url}/api/v0/me`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000) });
	if (!response.ok) throw new Error(`GoatCounter account check failed: HTTP ${response.status}`);
	const account = await response.json();
	const timezone = account.user?.settings?.timezone;
	if (typeof timezone !== 'string') throw new Error('GoatCounter account timezone is missing');
	return timezone.replace(/^[A-Z]{2}\./,'');
}

export async function readHits(url, token, start, end, fetcher = fetch) {
	const hits = [], excluded = new Set();
	for (let page = 0; page < 100; page++) {
		const endpoint = new URL('/api/v0/stats/hits', url);
		endpoint.search = new URLSearchParams({ start, end, limit: '100' }).toString();
		if (excluded.size) endpoint.searchParams.set('exclude_paths', [...excluded].join(','));
		const response = await fetcher(endpoint, {
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			signal: AbortSignal.timeout(30000)
		});
		if (!response.ok) throw new Error(`GoatCounter export failed: HTTP ${response.status}`);
		const data = await response.json();
		if (data.hits === null && data.more === false) return hits;
		if (!Array.isArray(data.hits) || typeof data.more !== 'boolean') throw new Error('Invalid GoatCounter response');
		let added = 0;
		for (const hit of data.hits) {
			if (!Number.isSafeInteger(hit.path_id) || excluded.has(hit.path_id)) throw new Error('Invalid GoatCounter pagination');
			excluded.add(hit.path_id); hits.push(hit); added++;
		}
		if (!data.more) return hits;
		if (!added) throw new Error('GoatCounter pagination did not advance');
		await new Promise(resolve => setTimeout(resolve, 300));
	}
	throw new Error('GoatCounter pagination exceeded safety limit');
}

export function createSnapshot(hits, slugs, { base, startDate, endDate, generatedAt, timezone }) {
	const rows = slugs.map(slug => ({ slug, visits: 0, daily: [] }));
	const byPath = new Map(rows.map(row => [`${base}/reports/${row.slug}`, row]));
	const seen = new Set();
	for (const hit of hits) {
		const row = byPath.get(hit.path?.replace(/\/$/, ''));
		if (!row || hit.event) continue;
		if (!Number.isSafeInteger(hit.count) || hit.count < 0 || !Array.isArray(hit.stats)) throw new Error('Invalid GoatCounter counts');
		if (seen.has(row.slug)) throw new Error('Duplicate canonical report path');
		seen.add(row.slug);
		row.visits = hit.count;
		row.daily = hit.stats.map(stat => {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(stat.day) || !Number.isSafeInteger(stat.daily) || stat.daily < 0 ||
				stat.day < startDate || stat.day > endDate) throw new Error('Invalid GoatCounter daily count');
			return { day: stat.day, visits: stat.daily };
		});
		if (new Set(row.daily.map(p => p.day)).size !== row.daily.length || row.daily.reduce((sum,p) => sum+p.visits,0) !== row.visits)
			throw new Error('Inconsistent GoatCounter daily counts');
	}
	return { version: 1, generatedAt, startDate, endDate, timezone, rows };
}

async function main() {
	const token = process.env.GOATCOUNTER_API_TOKEN;
	if (!token) throw new Error('GOATCOUNTER_API_TOKEN is required (read-only token; never use VITE_ prefix)');
	const url = 'https://video-wisper.goatcounter.com';
	// GoatCounter groups daily counts using the API owner's timezone.
	const timezone = 'Asia/Qyzylorda';
	if (await readTimezone(url,token) !== timezone) throw new Error('GoatCounter timezone must be Asia/Qyzylorda; review the export configuration');
	const startDate = process.env.GOATCOUNTER_START_DATE || '2026-10-03';
	const start = new Date(`${startDate}T00:00:00+05:00`);
	const end = new Date(); end.setUTCMinutes(0, 0, 0);
	const localDay = date => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit' }).format(date);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(start.getTime()) || localDay(start) !== startDate || start > end)
		throw new Error('Invalid GOATCOUNTER_START_DATE');
	const reports = JSON.parse(await readFile('src/lib/data/report-meta.json', 'utf8'));
	const collections = JSON.parse(await readFile('src/lib/data/collections.json', 'utf8'));
	const hits = await readHits(url, token, start.toISOString(), end.toISOString());
	const snapshot = createSnapshot(hits, publicSlugs(reports, collections), {
		base: process.env.BASE_PATH ?? '/video-wisper-web', startDate,
		endDate: localDay(end), generatedAt: new Date().toISOString(), timezone
	});
	await mkdir('static/analytics', { recursive: true });
	await writeFile('static/analytics/summary.json.tmp', JSON.stringify(snapshot));
	await rename('static/analytics/summary.json.tmp', 'static/analytics/summary.json');
	console.log(`Analytics exported: ${snapshot.rows.length} public materials; through ${end.toISOString()}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

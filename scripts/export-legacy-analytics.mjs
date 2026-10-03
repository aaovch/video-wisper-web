import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicSlugs } from './export-analytics.mjs';

export async function readLegacyCount(path, fetcher = fetch) {
	const url = new URL('https://page-views-api.ratneshc.com/api/v1/views');
	url.search = new URLSearchParams({ site:'aaovch.github.io', path }).toString();
	const response = await fetcher(url, { signal:AbortSignal.timeout(30000) });
	if (!response.ok) throw new Error(`Legacy count failed: HTTP ${response.status}`);
	const data = await response.json();
	if (!Number.isSafeInteger(data.views) || data.views<0) throw new Error('Invalid legacy count');
	return data.views;
}

export function projectLegacy(all, slugs) {
	const visible = new Set(slugs);
	return { version:1, source:all.source, capturedFrom:all.capturedFrom, capturedAt:all.capturedAt,
		siteVisits:all.siteVisits, rows:all.rows.filter(row=>visible.has(row.slug)) };
}

async function main() {
	const reports=JSON.parse(await readFile('src/lib/data/report-meta.json','utf8'));
	const collections=JSON.parse(await readFile('src/lib/data/collections.json','utf8'));
	const capturedFrom=new Date().toISOString();
	const siteVisits=await readLegacyCount('/video-wisper-web');
	const rows=[];
	// Read-only and paced: never call /track while preserving history.
	for (const report of reports) {
		rows.push({slug:report.slug,visits:await readLegacyCount(`/video-wisper-web/reports/${report.slug}`)});
		await new Promise(resolve=>setTimeout(resolve,250));
		if(rows.length%25===0) console.log(`Historical backup: ${rows.length}/${reports.length} materials`);
	}
	const all={version:1,source:'Page Views API',capturedFrom,capturedAt:new Date().toISOString(),siteVisits,rows};
	const publicData=projectLegacy(all,publicSlugs(reports,collections));
	await mkdir('.codex/analytics',{recursive:true});
	// Complete backup also covers private materials; never send it to the public site.
	await writeFile('.codex/analytics/legacy-all.json',JSON.stringify(all,null,2)+'\n');
	await writeFile('src/lib/data/legacy-analytics.json.tmp',JSON.stringify(publicData,null,2)+'\n');
	await rename('src/lib/data/legacy-analytics.json.tmp','src/lib/data/legacy-analytics.json');
	console.log(`Historical backup complete: ${rows.length} materials; ${publicData.rows.length} public; site total ${siteVisits}`);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))
	main().catch(error=>{console.error(error.message);process.exitCode=1;});

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { collections } from '$lib/data/collections';
import { searchableReportSlugs } from '$lib/search-visibility';
import { groupByReport, resetSearchIndex, searchScoped, whenSearchComplete } from '$lib/search-core';
import type { SearchScope } from '$lib/search-types';
import { searchHitKey } from './search-hit-key';
import cases from './search-quality-cases.json';

// Actual build artifacts: same shards, loader, ranking and grouping as the UI.
// Run npm run test:search-quality to rebuild them before evaluation.
beforeAll(async () => {
	resetSearchIndex();
	const files = new Map(['index-core.json', 'index-transcripts.json', 'chapter-titles.json']
		.map(name => [name, readFileSync(`static/search/${name}`, 'utf8')]));
	vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
		const name = String(input).split('/').pop()!;
		const body = files.get(name);
		return new Response(body ?? '', { status: body === undefined ? 404 : 200 });
	}));
	await whenSearchComplete();
}, 60000);

afterAll(() => { resetSearchIndex(); vi.unstubAllGlobals(); });

it('evaluates grounded questions across report, collection and public archive', async () => {
	const visible = searchableReportSlugs([], 'all');
	const rows = [];
	const alternativeRaw = readFileSync('scripts/search-enrichment/quality-alternatives.json', 'utf8');
	expect(createHash('sha256').update(alternativeRaw).digest('hex')).toBe(readFileSync('scripts/search-enrichment/quality-alternatives.sha256','utf8').trim());
	const alternativeReview = JSON.parse(alternativeRaw);
	for (const item of cases) {
		const report = JSON.parse(readFileSync(`src/lib/data/reports/${item.reportSlug}.json`, 'utf8'));
		for (const evidence of item.evidence) {
			expect(report.chapters[evidence.chapterIndex].title).toBe(evidence.title);
			expect(report.chapters[evidence.chapterIndex].theses).toContain(evidence.quote);
		}
		const alternatives = alternativeReview.cases.find((q: any) => q.id === item.id)?.alternatives ?? [];
		for (const alternative of alternatives) {
			const sourceReport = JSON.parse(readFileSync(`src/lib/data/reports/${alternative.reportSlug}.json`, 'utf8'));
			const source = alternative.sourcePath.reduce((value: any, key: string | number) => value[key], sourceReport);
			expect(createHash('sha256').update(JSON.stringify(source)).digest('hex')).toBe(alternative.sourceHash);
			expect(source.definition).toBe(alternative.evidence);
		}
		expect(visible).toContain(item.reportSlug);
		const collection = collections.find(c => c.items.includes(item.reportSlug) && !c.password)!;
		expect(collection).toBeDefined();
		const scopes: SearchScope[] = [
			{ kind: 'report', label: item.reportSlug, reportSlug: item.reportSlug },
			{ kind: 'collection', label: collection.slug, reportSlugs: collection.items.filter(s => visible.includes(s)) },
			{ kind: 'archive', label: 'public archive', reportSlugs: visible }
		];
		for (const scope of scopes) {
			const response = await searchScoped(item.query, [scope], 120);
			expect(response.pending).toBe(false);
			expect(response.hits.every(h => scope.kind === 'report'
				? h.reportSlug === scope.reportSlug : scope.reportSlugs.includes(h.reportSlug))).toBe(true);
			const groups = groupByReport(response.hits);
			const reportRank = groups.findIndex(g => g.reportSlug === item.reportSlug) + 1;
			const rawPassageRank = response.hits.findIndex(h => h.reportSlug === item.reportSlug
				&& h.chapterIndex !== undefined && item.chapters.includes(h.chapterIndex)) + 1;
			// Rank the same distinct destinations shown by the UI, retaining the raw
			// rank for diagnosis. Repeated theses must not consume visible positions.
			const seen = new Set<string>();
			const visibleHits = response.hits.filter(h => {
				const key = searchHitKey(h); if (seen.has(key)) return false; seen.add(key); return true;
			});
			const passageRank = visibleHits.findIndex(h => h.reportSlug === item.reportSlug
				&& h.chapterIndex !== undefined && item.chapters.includes(h.chapterIndex)) + 1;
			const sourceRank = visibleHits.findIndex(h =>
				(h.reportSlug === item.reportSlug && h.chapterIndex !== undefined && item.chapters.includes(h.chapterIndex)) ||
				alternatives.some((a: any) => a.grade === 3 && h.reportSlug === a.reportSlug && h.kind === a.kind && h.title === a.title)) + 1;
			rows.push({ id: item.id, query: item.query, scope: scope.kind, scopeLabel: scope.label,
				matchKind: response.matchKind, reportRank, passageRank, rawPassageRank, sourceRank,
				top: visibleHits.slice(0, 5).map(h => ({ slug: h.reportSlug, chapter: h.chapterIndex, title: h.title, start: h.start })) });
		}
	}
	const metrics = scopesMetrics(rows);
	console.log(JSON.stringify(metrics, null, 2));
	if (process.env.SEARCH_EVAL_OUTPUT) writeFileSync(process.env.SEARCH_EVAL_OUTPUT, JSON.stringify({ metrics, rows }, null, 2) + '\n');
	expect(rows).toHaveLength(cases.length * 3);
	// Incomplete relevance judgments: these questions remain visible in the
	// report, but are not a license to regress any currently successful case.
	const knownMisses = new Set(['q11:collection', 'q11:archive', 'q22:archive']);
	for (const row of rows) {
		if (knownMisses.has(`${row.id}:${row.scope}`)) continue;
		expect(row.sourceRank, `${row.id} ${row.scope}: ${row.query}`).toBeGreaterThan(0);
		expect(row.sourceRank, `${row.id} ${row.scope}: ${row.query}`).toBeLessThanOrEqual(5);
	}
	for (const [index, floor] of [24, 23, 21].entries()) {
		expect(metrics[index].reportHit3).toBeGreaterThanOrEqual(floor);
	}
}, 120000);

function scopesMetrics(rows: { scope: string; reportRank: number; passageRank: number; sourceRank: number }[]) {
	return ['report', 'collection', 'archive'].map(scope => {
		const subset = rows.filter(r => r.scope === scope);
		return { scope, questions: subset.length,
			reportHit3: subset.filter(r => r.reportRank > 0 && r.reportRank <= 3).length,
			passageHit5: subset.filter(r => r.passageRank > 0 && r.passageRank <= 5).length,
			reviewedSourceHit5: subset.filter(r => r.sourceRank > 0 && r.sourceRank <= 5).length,
			passageMRR: Number((subset.reduce((sum, r) => sum + (r.passageRank ? 1 / r.passageRank : 0), 0) / subset.length).toFixed(3)) };
	});
}

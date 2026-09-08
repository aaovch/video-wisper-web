import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { validateEnrichment } from './core.mjs';
import judgments from './fencing-pooled.json';
import fencing from './fencing-cases.json';

const slug = 'context-engineering-29min';
const report = JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`, 'utf8'));
const data = JSON.parse(readFileSync(`src/lib/data/search-enrichment/${slug}.json`, 'utf8'));

it('grounds the fencing review in source chapters and existing query IDs', () => {
	for (const judgment of judgments.judgments) {
		expect(fencing.cases.some(q => q.id === judgment.queryId)).toBe(true);
		const [slug, index] = judgment.documentId.split(':chapter:');
		const report = JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`, 'utf8'));
		const c = report.chapters[Number(index)];
		expect([c.summary, ...c.theses].join('\n')).toContain(judgment.evidence);
	}
});

it('accepts grounded pilot metadata without changing its source', () => {
	const before = JSON.stringify(report);
	expect(validateEnrichment(report, data)).toBe(data);
	expect(JSON.stringify(report)).toBe(before);
});

it('rejects old metadata after a source edit or chapter reorder', () => {
	const changed = structuredClone(report);
	changed.chapters[0].summary += ' Правка.';
	expect(() => validateEnrichment(changed, data)).toThrow('Stale source');
	[changed.chapters[0], changed.chapters[1]] = [changed.chapters[1], changed.chapters[0]];
	expect(() => validateEnrichment(changed, data)).toThrow('Stale source');
});

it('rejects invented evidence, duplicate chapters, wrong report and oversized questions', () => {
	const bad = structuredClone(data);
	bad.chapters[0].questions[0].evidence = 'Несуществующая цитата из источника.';
	expect(() => validateEnrichment(report, bad)).toThrow('Ungrounded evidence');
	const duplicate = structuredClone(data);
	duplicate.chapters.push(duplicate.chapters[0]);
	expect(() => validateEnrichment(report, duplicate)).toThrow('duplicate');
	expect(() => validateEnrichment(report, { ...data, reportSlug: 'other' })).toThrow('reportSlug');
	const long = structuredClone(data);
	long.chapters[0].questions[0].text = 'а'.repeat(221);
	expect(() => validateEnrichment(report, long)).toThrow('Invalid text');
});

it('supports machine-readable preparation dry runs and rejects path traversal', () => {
	const output = execFileSync(process.execPath, ['scripts/search-enrichment/cli.mjs', 'prepare', slug, '--dry-run'], { encoding: 'utf8' });
	expect(JSON.parse(output)).toMatchObject({ ok: true, dryRun: true, chapters: 12 });
	expect(() => execFileSync(process.execPath, ['scripts/search-enrichment/cli.mjs', 'prepare', '../report', '--dry-run'], { stdio: 'pipe' })).toThrow();
});

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import collections from '../src/lib/data/collections.json';

const verifier = resolve('scripts/verify-search-index.mjs');
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

it('counts a long summary separately from overview theses', () => {
	const cwd = mkdtempSync(join(tmpdir(), 'verify-search-index-'));
	try {
		mkdirSync(join(cwd, 'src/lib/data/reports'), { recursive: true });
		mkdirSync(join(cwd, 'static/search'), { recursive: true });
		writeFileSync(join(cwd, 'src/lib/data/collections.json'), '[]');
		writeFileSync(join(cwd, 'src/lib/data/reports/fixture.json'), JSON.stringify({
			overview_theses: ['Overview'], long_summary: 'Long summary', chapters: [{ theses: ['Thesis'] }]
		}));
		writeFileSync(join(cwd, 'static/search/manifest.json'), JSON.stringify({
			reportDocuments: { fixture: { report: 1, chapter: 1, overview: 2, thesis: 1 } }
		}));
		const output = execFileSync(process.execPath, [verifier, 'fixture'], { cwd, encoding: 'utf8' });
		expect(output).toContain('search-index OK: fixture');
		expect(output).toContain('2 theses');
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

it('omits all other topics from both built shards, chapter titles and the manifest', () => {
	const hidden = collections.filter(collection => !collection.hema).flatMap(collection => collection.items);
	const manifest = read('static/search/manifest.json');
	const titles = read('static/search/chapter-titles.json');
	const metadata = read('src/lib/data/report-meta.json');
	for (const slug of hidden) {
		expect(manifest.reportDocuments[slug], slug).toBeUndefined();
		expect(titles[slug], slug).toBeUndefined();
		// Existing collection/report URLs still have the metadata they need.
		expect(metadata.some((report: { slug: string }) => report.slug === slug), slug).toBe(true);
	}
	for (const shard of ['core', 'transcripts']) {
		const docs = Object.values(read(`static/search/index-${shard}.json`).storedFields) as { reportSlug: string }[];
		expect(docs.some(doc => doc.reportSlug === 'longsword-a')).toBe(true);
		expect(docs.filter(doc => hidden.includes(doc.reportSlug))).toEqual([]);
	}
	const output = execFileSync(process.execPath, [verifier, 'nri-staraya-shahta'], { encoding: 'utf8' });
	expect(output).toContain('search-index EXCLUDED: nri-staraya-shahta');
});

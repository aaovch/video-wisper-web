import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const slug = process.argv[2];
if (!slug) {
	console.error('Usage: npm run verify-search-index -- <report-slug>');
	process.exit(2);
}

const root = process.cwd();
const report = JSON.parse(readFileSync(join(root, 'src/lib/data/reports', `${slug}.json`), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'static/search/manifest.json'), 'utf8'));
const indexed = manifest.reportDocuments?.[slug];

if (!indexed) throw new Error(`Report ${slug} is absent from the preliminary search index`);
if (indexed.report !== 1) throw new Error(`Expected one report document for ${slug}, got ${indexed.report ?? 0}`);

const expectedChapters = report.chapters?.length ?? 0;
if ((indexed.chapter ?? 0) !== expectedChapters) {
	throw new Error(`Chapter index mismatch for ${slug}: expected ${expectedChapters}, got ${indexed.chapter ?? 0}`);
}

const expectedTheses = (report.overview_theses?.length ?? 0) +
	(report.chapters ?? []).reduce((total, chapter) => total + (chapter.theses?.length ?? 0), 0);
const indexedTheses = (indexed.overview ?? 0) + (indexed.thesis ?? 0);
if (indexedTheses !== expectedTheses) {
	throw new Error(`Thesis index mismatch for ${slug}: expected ${expectedTheses}, got ${indexedTheses}`);
}

const transcriptPath = join(root, 'src/lib/data/transcripts', `${slug}.json`);
const sidecar = existsSync(transcriptPath) ? JSON.parse(readFileSync(transcriptPath, 'utf8')) : null;
const sourceSegments = (sidecar?.chapters ?? []).reduce(
	(total, chapter) => total + (chapter.segments?.length ?? 0),
	0
);
if (sourceSegments > 0 && !(indexed.transcript > 0)) {
	throw new Error(`Transcript windows are absent for ${slug}`);
}
if (report.has_transcript && !existsSync(transcriptPath)) {
	throw new Error(`Report ${slug} declares has_transcript, but src/lib/data/transcripts/${slug}.json is missing`);
}

console.log(`search-index OK: ${slug}; ${indexed.chapter ?? 0} chapters, ${indexedTheses} theses, ${indexed.transcript ?? 0} transcript windows, ${indexed.material ?? 0} materials`);

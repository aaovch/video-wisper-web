import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const reportsDir = join(root, 'src/lib/data/reports');
const transcriptsDir = join(root, 'src/lib/data/transcripts');
const collectionsPath = join(root, 'src/lib/data/collections.ts');
const requested = process.argv.slice(2).find((arg) => arg !== '--json');
const jsonOutput = process.argv.includes('--json');
const errors = [];
const warnings = [];

function issue(list, code, message, details = {}) {
	list.push({ code, message, ...details });
}

function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function loadCollections() {
	const source = readFileSync(collectionsPath, 'utf8');
	const marker = 'export const collections: Collection[] =';
	const markerIndex = source.indexOf(marker);
	if (markerIndex < 0) throw new Error('collections export marker not found');
	const start = source.indexOf('[', markerIndex + marker.length);
	const end = source.indexOf('\n];', start);
	if (start < 0 || end < 0) throw new Error('collections array boundary not found');
	const literal = source.slice(start, end + 2);
	return Function(`"use strict"; return (${literal});`)();
}

const reportFiles = readdirSync(reportsDir).filter((name) => name.endsWith('.json')).sort();
const reports = new Map();
const sources = new Map();
for (const file of reportFiles) {
	const report = readJson(join(reportsDir, file));
	const fileSlug = file.slice(0, -5);
	const selectedReport = requested && requested !== '--all' && requested === fileSlug;
	const strictProvenance = selectedReport || Boolean(report.source_stem);
	reports.set(report.slug, report);
	if (report.slug !== fileSlug) issue(errors, 'REPORT_FILENAME_MISMATCH', `${file} содержит slug ${report.slug}`);
	if (!report.title?.trim() || !report.subtitle?.trim()) issue(errors, 'REPORT_TEXT_MISSING', `Нет title/subtitle: ${fileSlug}`);
	if (!Array.isArray(report.overview_theses) || report.overview_theses.length === 0) issue(errors, 'OVERVIEW_MISSING', `Нет overview_theses: ${fileSlug}`);
	if (!Array.isArray(report.chapters) || report.chapters.length === 0) issue(errors, 'CHAPTERS_MISSING', `Нет chapters: ${fileSlug}`);
	let previousStart = -Infinity;
	for (const [index, chapter] of (report.chapters ?? []).entries()) {
		if (!Number.isFinite(chapter.start) || chapter.start <= previousStart) issue(errors, 'CHAPTER_ORDER_INVALID', `${fileSlug} chapter ${index}`);
		if (!chapter.title?.trim() || !chapter.summary?.trim() || !Array.isArray(chapter.theses) || chapter.theses.length === 0) issue(errors, 'CHAPTER_CONTENT_MISSING', `${fileSlug} chapter ${index}`);
		previousStart = chapter.start;
	}
	if (report.video?.provider && (report.video?.id || report.video?.src)) {
		const identity = report.video.provider === 'file' ? report.video.src : report.video.id;
		const key = `${report.video.provider}:${identity}`;
		const previous = sources.get(key);
		if (previous && previous !== fileSlug) issue(errors, 'DUPLICATE_VIDEO_SOURCE', `${key}: ${previous}, ${fileSlug}`);
		sources.set(key, fileSlug);
	}
	if (report.has_transcript) {
		const transcriptPath = join(transcriptsDir, `${fileSlug}.json`);
		if (!existsSync(transcriptPath)) {
			issue(errors, 'TRANSCRIPT_SIDECAR_MISSING', fileSlug);
		} else {
			const sidecar = readJson(transcriptPath);
			if (!sidecar.transcript?.trim()) issue(errors, 'TRANSCRIPT_TEXT_MISSING', fileSlug);
			if ((sidecar.chapters?.length ?? 0) !== (report.chapters?.length ?? 0)) issue(errors, 'SIDECAR_CHAPTER_MISMATCH', fileSlug);
			for (const [index, chapter] of (report.chapters ?? []).entries()) {
				const sidecarChapter = sidecar.chapters?.[index];
				if (!sidecarChapter || sidecarChapter.start !== chapter.start) issue(errors, 'SIDECAR_START_MISMATCH', `${fileSlug} chapter ${index}`);
				if (strictProvenance && chapter.anchor) {
					const text = (sidecarChapter?.segments ?? []).find((segment) => segment.start === chapter.start)?.text ?? '';
					if (!text.includes(chapter.anchor)) issue(errors, 'ANCHOR_MISMATCH', `${fileSlug} chapter ${index}`);
				}
			}
		}
	}
	if (selectedReport && !report.source_stem) issue(warnings, 'SOURCE_STEM_LEGACY', `Нет source_stem: ${fileSlug}`);
}

let collections;
try {
	collections = loadCollections();
} catch (error) {
	issue(errors, 'COLLECTIONS_PARSE_FAILED', error.message);
	collections = [];
}
const collectionSlugs = new Set();
for (const collection of collections) {
	if (collectionSlugs.has(collection.slug)) issue(errors, 'COLLECTION_SLUG_DUPLICATE', collection.slug);
	collectionSlugs.add(collection.slug);
	if ('password' in collection && !collection.password?.trim()) issue(errors, 'COLLECTION_PASSWORD_INVALID', collection.slug);
	const items = collection.items ?? [];
	if (new Set(items).size !== items.length) issue(errors, 'COLLECTION_ITEM_DUPLICATE', collection.slug);
	for (const slug of items) if (!reports.has(slug)) issue(errors, 'COLLECTION_REPORT_MISSING', `${collection.slug}: ${slug}`);
	if (collection.sections?.length) {
		const sectionItems = collection.sections.flatMap((section) => section.items ?? []);
		for (const slug of sectionItems) if (!items.includes(slug)) issue(errors, 'SECTION_ITEM_OUTSIDE_ROOT', `${collection.slug}: ${slug}`);
		for (const slug of items) if (!sectionItems.includes(slug)) issue(errors, 'SECTION_ITEM_MISSING', `${collection.slug}: ${slug}`);
		if (new Set(sectionItems).size !== sectionItems.length) issue(errors, 'SECTION_ITEM_DUPLICATE', collection.slug);
	}
}

if (requested && requested !== '--all' && !reports.has(requested)) issue(errors, 'REPORT_NOT_FOUND', requested);
const payload = { ok: errors.length === 0, reports: reports.size, collections: collections.length, errors, warnings };
if (jsonOutput) console.log(JSON.stringify(payload));
else {
	console.log(`site-data ${payload.ok ? 'PASS' : 'FAIL'}: ${reports.size} reports, ${collections.length} collections, ${warnings.length} warnings`);
	for (const error of errors) console.error(`ERROR ${error.code}: ${error.message}`);
	for (const warning of warnings.slice(0, 10)) console.warn(`WARN ${warning.code}: ${warning.message}`);
	if (warnings.length > 10) console.warn(`WARN ... and ${warnings.length - 10} more`);
}
if (!payload.ok) process.exit(3);

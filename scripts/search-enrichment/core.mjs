import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PROMPT_VERSION = 'chapter-search-v1';
export const sourceFor = (report, chapterIndex) => ({
	reportTitle: report.title, chapterIndex, chapter: report.chapters[chapterIndex]
});
export const sourceHash = source => createHash('sha256').update(JSON.stringify(source)).digest('hex');
export const sourceText = source => [source.chapter.title, source.chapter.summary,
	...(source.chapter.theses ?? [])].filter(Boolean).join('\n');

function assert(condition, message) { if (!condition) throw new Error(message); }
export function validateEnrichment(report, data) {
	assert(data?.version === 1 && data.reportSlug === report.slug, 'Invalid version or reportSlug');
	assert(data.promptVersion === PROMPT_VERSION, 'Unsupported promptVersion');
	assert(typeof data.generator === 'string' && data.generator.trim().length > 0, 'Missing generator provenance');
	assert(Array.isArray(data.chapters) && data.chapters.length > 0, 'Missing chapters');
	const seen = new Set();
	for (const entry of data.chapters) {
		const i = entry.chapterIndex;
		assert(Number.isInteger(i) && i >= 0 && i < report.chapters.length && !seen.has(i), 'Invalid or duplicate chapterIndex');
		seen.add(i);
		const source = sourceFor(report, i);
		assert(entry.sourceHash === sourceHash(source), `Stale source: chapter ${i}`);
		const text = sourceText(source);
		const check = (item, max) => {
			assert(item && typeof item.text === 'string' && item.text.trim().length > 0 && item.text.length <= max, `Invalid text: chapter ${i}`);
			assert(typeof item.evidence === 'string' && item.evidence.trim().length >= 16 && text.includes(item.evidence), `Ungrounded evidence: chapter ${i}`);
		};
		check(entry.context, 600);
		assert(Array.isArray(entry.questions) && entry.questions.length >= 1 && entry.questions.length <= 5, `Expected 1–5 questions: chapter ${i}`);
		const questions = new Set();
		for (const item of entry.questions) {
			check(item, 220);
			const normalized = item.text.toLowerCase().replace(/ё/g, 'е').trim();
			assert(!questions.has(normalized), `Duplicate question: chapter ${i}`);
			questions.add(normalized);
		}
	}
	return data;
}

// A changed source is never silently paired with an old expansion. Build fails
// with an actionable error; ordinary reports with no sidecar need no model.
export function readEnrichment(root, report) {
	const path = join(root, 'src/lib/data/search-enrichment', `${report.slug}.json`);
	return existsSync(path) ? validateEnrichment(report, JSON.parse(readFileSync(path, 'utf8'))) : null;
}

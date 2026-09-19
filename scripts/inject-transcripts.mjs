/**
 * Пересобирает sidecar-транскрипты (src/lib/data/transcripts/<slug>.json) из
 * output/<stem>/transcript.json: сегменты по границам глав + полный текст.
 * В отчёт сегменты/расшифровка НЕ кладутся — только флаг has_transcript.
 *
 * Источник для отчёта определяется по полю source_stem:
 * output/<source_stem>/transcript.json. Все отчёты обязаны хранить provenance,
 * поэтому ручного реестра соответствий здесь больше нет.
 *
 * Запуск из корня video-wisper-web: node scripts/inject-transcripts.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pipelineRoot = join(root, '..');
const reportsDir = join(root, 'src/lib/data/reports');
const transcriptsDir = join(root, 'src/lib/data/transcripts');

function chapterBounds(chapters) {
	return chapters.map((ch, i) => ({
		start: ch.start,
		end: i < chapters.length - 1 ? chapters[i + 1].start : Infinity
	}));
}

function isExcludedSegment(segment, excludeRanges) {
	return excludeRanges.some((range) => segment.start >= range.start && segment.start < range.end);
}

function assignSegments(segments, chapters) {
	const bounds = chapterBounds(chapters);
	return chapters.map((ch, i) => {
		const segs = segments
			.filter((s) => s.start >= bounds[i].start && s.start < bounds[i].end)
			.map((s) => ({ start: s.start, text: s.text.trim() }))
			.filter((s) => s.text.length > 0);
		return { ...ch, segments: segs };
	});
}

mkdirSync(transcriptsDir, { recursive: true });

/** Собирает источники из канонического source_stem каждого отчёта. */
function resolveSources() {
	const sources = [];
	for (const file of readdirSync(reportsDir).filter((name) => name.endsWith('.json'))) {
		const reportPath = join(reportsDir, file);
		const report = JSON.parse(readFileSync(reportPath, 'utf8'));
		if (!report.source_stem) throw new Error(`${file}: отсутствует source_stem`);
		const transcriptPath = join(pipelineRoot, 'output', report.source_stem, 'transcript.json');
		sources.push({ reportPath, transcriptPath, excludeRanges: report.exclude_ranges ?? [] });
	}
	return sources;
}

for (const { reportPath, transcriptPath, excludeRanges = [] } of resolveSources()) {
	if (!existsSync(transcriptPath)) {
		console.warn(`SKIP ${reportPath}: нет транскрипта ${transcriptPath}`);
		continue;
	}
	const report = JSON.parse(readFileSync(reportPath, 'utf8'));
	const transcript = JSON.parse(readFileSync(transcriptPath, 'utf8'));
	const segments = (transcript.segments ?? []).filter(
		(segment) => !isExcludedSegment(segment, excludeRanges)
	);

	// Сегменты и полный текст не кладём в отчёт (иначе страница тяжелеет) —
	// пишем sidecar, который читают только билд-скрипты.
	const chaptersWithSegments = assignSegments(segments, report.chapters);
	const sidecar = {
		transcript: segments
			.map((segment) => segment.text.trim())
			.filter(Boolean)
			.join(' '),
		chapters: chaptersWithSegments.map((ch) => ({ start: ch.start, segments: ch.segments }))
	};
	writeFileSync(
		join(transcriptsDir, `${report.slug}.json`),
		JSON.stringify(sidecar, null, '\t') + '\n',
		'utf8'
	);

	for (const ch of report.chapters) delete ch.segments;
	delete report.transcript;
	report.has_transcript = sidecar.transcript.length > 0;
	writeFileSync(reportPath, JSON.stringify(report, null, '\t') + '\n', 'utf8');

	const total = chaptersWithSegments.reduce((n, ch) => n + (ch.segments?.length ?? 0), 0);
	console.log(`${report.slug}: ${total} сегментов в ${report.chapters.length} блоках`);
}

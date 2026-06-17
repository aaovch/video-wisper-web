/**
 * Вкладывает сегменты транскрипта Whisper в chapters[].segments по тайм-кодам блоков.
 * Запуск из корня video-wisper-web: node scripts/inject-transcripts.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pipelineRoot = join(root, '..');

const SOURCES = [
	{
		reportPath: join(root, 'src/lib/data/reports/retention.json'),
		transcriptPath: join(pipelineRoot, 'output/2026-06-13 14-57-04/transcript.json')
	},
	{
		reportPath: join(root, 'src/lib/data/reports/metodichka.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Методичка к семинару _Вакцина от ударов по рукам_/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/berezhnoy-ai.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Искусственный интеллект, найм и образование ｜ Сергей Бережной, CTO Практикума, директор в Яндексе [V3fahH0XA0M]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/hema-reflections.json'),
		transcriptPath: join(pipelineRoot, 'output/Что такое HEMA？ Размышления [5gfdZi36pgU]/transcript.json')
	},
	{
		reportPath: join(root, 'src/lib/data/reports/software-3-0.json'),
		transcriptPath: join(pipelineRoot, 'output/Software 3.0： код будущего [CDpnhKypevg]/transcript.json')
	},
	{
		reportPath: join(root, 'src/lib/data/reports/longsword-a.json'),
		transcriptPath: join(pipelineRoot, 'output/Longsword A [Mg780unogxM]/transcript.json')
	}
];

function chapterBounds(chapters) {
	return chapters.map((ch, i) => ({
		start: ch.start,
		end: i < chapters.length - 1 ? chapters[i + 1].start : Infinity
	}));
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

for (const { reportPath, transcriptPath } of SOURCES) {
	const report = JSON.parse(readFileSync(reportPath, 'utf8'));
	const transcript = JSON.parse(readFileSync(transcriptPath, 'utf8'));
	const segments = transcript.segments ?? [];

	report.chapters = assignSegments(segments, report.chapters);
	if (transcript.full_text) {
		report.transcript = transcript.full_text.trim();
	}

	writeFileSync(reportPath, JSON.stringify(report, null, '\t') + '\n', 'utf8');

	const total = report.chapters.reduce((n, ch) => n + (ch.segments?.length ?? 0), 0);
	console.log(`${report.slug}: ${total} сегментов в ${report.chapters.length} блоках`);
}

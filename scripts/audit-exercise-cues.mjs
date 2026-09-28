import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// These phrases locate places to read, not proof that a practical assignment exists.
const cue = /(?:первое|второе|следующее|последнее|новое) упражнение|упражнение\s*(?:№\s*)?\d+|(?:ваша|наша) задача|(?:сейчас|теперь|дальше) (?:мы с вами )?(?:будем )?(?:делать|работать|работаем|попробуем)|(?:first|next|second) (?:exercise|drill)|let's (?:practice|try)/i;
const dataDir = join(process.cwd(), 'src/lib/data');
const args = process.argv.slice(2);
const requested = args.find((arg) => !arg.startsWith('--'));
const jsonOutput = args.includes('--json');
const reportFiles = readdirSync(join(dataDir, 'reports')).filter((name) => name.endsWith('.json')).sort();
const reports = [];

for (const file of reportFiles) {
	const slug = file.slice(0, -5);
	if (requested && requested !== slug) continue;
	const report = JSON.parse(readFileSync(join(dataDir, 'reports', file), 'utf8'));
	const sidecarPath = join(dataDir, 'transcripts', file);
	const sidecar = existsSync(sidecarPath) ? JSON.parse(readFileSync(sidecarPath, 'utf8')) : null;
	const cues = (sidecar?.chapters ?? []).flatMap((chapter) => (chapter.segments ?? []).flatMap((segment) =>
		cue.test(segment.text) ? [{ start: segment.start, text: segment.text }] : []
	));
	const exerciseCount = (report.materials?.exercises ?? report.seminar_exercises ?? [])
		.reduce((sum, section) => sum + (section.items?.length ?? 0), 0);
	reports.push({ slug, title: report.title, exerciseCount, hasTranscript: Boolean(sidecar), cues });
}

if (requested && reports.length === 0) {
	console.error(`Report not found: ${requested}`);
	process.exit(2);
}
const payload = {
	ok: true,
	reports: reports.length,
	withoutExercisesWithCues: reports.filter((report) => report.exerciseCount === 0 && report.cues.length > 0).length,
	results: reports
};
if (jsonOutput) console.log(JSON.stringify(payload));
else {
	console.log(`Exercise cue review: ${payload.reports} reports, ${payload.withoutExercisesWithCues} without exercise lists have cues`);
	const visible = reports.filter((item) => item.cues.length > 0 && (requested || item.exerciseCount === 0));
	for (const report of visible.sort((a, b) => b.cues.length - a.cues.length)) {
		console.log(`${report.slug}: ${report.exerciseCount} exercises, ${report.cues.length} cues`);
		if (requested) for (const item of report.cues) console.log(`  ${item.start.toFixed(2)} ${item.text}`);
	}
}

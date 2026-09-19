import type { Report, ReportMaterialVisual, ReportMaterials } from '$lib/types';

/**
 * Нормализует старые плоские поля отчёта в общий контракт материалов.
 * Совместимость нужна для локальных старых spec-файлов и не влияет на новые отчёты.
 */
export function getReportMaterials(report: Report): Required<ReportMaterials> {
	const legacyVisuals: ReportMaterialVisual[] = [];
	if (report.infographic) legacyVisuals.push({ kind: 'infographic', ...report.infographic });
	if (report.exercise_memo) legacyVisuals.push({ kind: 'exercise-memo', ...report.exercise_memo });

	return {
		notes: report.materials?.notes ?? report.seminar_notes ?? [],
		exercises: report.materials?.exercises ?? report.seminar_exercises ?? [],
		glossary: report.materials?.glossary ?? report.glossary ?? [],
		visuals: report.materials?.visuals ?? legacyVisuals
	};
}

export function materialVisualLabel(visual: ReportMaterialVisual): string {
	if (visual.label) return visual.label;
	if (visual.kind === 'exercise-memo') return 'Памятка по упражнениям';
	if (visual.kind === 'infographic') return 'Инфографика';
	return 'Материал';
}

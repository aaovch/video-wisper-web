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

export function materialVisualLabel(visual: ReportMaterialVisual, language: 'ru' | 'en' = 'ru'): string {
	if (visual.label) return visual.label;
	if (language === 'en') {
		if (visual.kind === 'exercise-memo') return 'Exercise guide';
		if (visual.kind === 'infographic') return 'Infographic';
		return 'Material';
	}
	if (visual.kind === 'exercise-memo') return 'Памятка по упражнениям';
	if (visual.kind === 'infographic') return 'Инфографика';
	return 'Материал';
}

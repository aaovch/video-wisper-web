import type { ReportMaterialVisual } from '$lib/types';
export { getReportMaterials, exerciseAnchor } from './report-material-data.js';

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

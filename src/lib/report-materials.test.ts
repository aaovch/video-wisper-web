import { describe, expect, it } from 'vitest';
import { getReportMaterials, materialVisualLabel } from './report-materials';
import type { Report } from './types';

const report = (patch: Partial<Report>): Report => patch as Report;

describe('getReportMaterials', () => {
	it('normalizes every legacy material field', () => {
		const materials = getReportMaterials(report({
			seminar_notes: [{ title: 'Конспект', items: ['Тезис'] }],
			seminar_exercises: [{ title: 'Практика', items: [{ start: 42, text: 'Повторить' }] }],
			glossary: [{ term: 'Термин', definition: 'Определение' }],
			infographic: { src: 'info.png', alt: 'Инфографика' },
			exercise_memo: { src: 'memo.png', alt: 'Памятка' }
		}));

		expect(materials.notes[0].title).toBe('Конспект');
		expect(materials.exercises[0].items[0].text).toBe('Повторить');
		expect(materials.glossary[0].term).toBe('Термин');
		expect(materials.visuals.map(({ kind }) => kind)).toEqual(['infographic', 'exercise-memo']);
	});

	it('prefers canonical material arrays without duplicating legacy visuals', () => {
		const materials = getReportMaterials(report({
			materials: {
				notes: [],
				visuals: [{ kind: 'other', label: 'Схема', src: 'scheme.png', alt: 'Схема' }]
			},
			seminar_notes: [{ title: 'Старое', items: ['Не использовать'] }],
			infographic: { src: 'scheme.png', alt: 'Схема' }
		}));

		expect(materials.notes).toEqual([]);
		expect(materials.visuals).toHaveLength(1);
		expect(materialVisualLabel(materials.visuals[0])).toBe('Схема');
	});
});

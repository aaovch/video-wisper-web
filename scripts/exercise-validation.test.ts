import { describe, expect, it } from 'vitest';
import { validateExercises } from './exercise-validation.mjs';

describe('reviewed exercise data', () => {
	it('accepts grouped exercises in a different section order', () => {
		const result = validateExercises({
			duration: 120,
			materials: { exercises: [
				{ title: 'Second topic', items: [{ start: 80, text: 'Do the second drill.' }] },
				{ title: 'First topic', items: [{ start: 20, text: 'Do the first drill.' }] }
			] }
		}, { chapters: [{ segments: [{ start: 20 }, { start: 80 }] }] });
		expect(result).toEqual({ errors: [], warnings: [] });
	});

	it('rejects broken text, out-of-range times, and colliding search anchors', () => {
		const result = validateExercises({
			duration: 120,
			materials: { exercises: [{ title: ' ', items: [
				{ start: 20, text: 'First drill' },
				{ start: 20.004, text: ' ' },
				{ start: 120, text: 'After the video' }
			] }] }
		});
		expect(result.errors).toHaveLength(4);
		expect(result.errors.join(' ')).toContain('duplicates an exercise anchor');
	});

	it('flags a timestamp far from source speech for review', () => {
		const result = validateExercises({
			duration: 120,
			materials: { exercises: [{ title: 'Practice', items: [{ start: 65, text: 'Do the drill.' }] }] }
		}, { chapters: [{ segments: [{ start: 20 }, { start: 40 }] }] });
		expect(result.errors).toEqual([]);
		expect(result.warnings).toHaveLength(1);
	});
});

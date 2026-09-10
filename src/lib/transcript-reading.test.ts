import { describe, expect, it } from 'vitest';
import { timedTranscriptParagraphs, transcriptParagraphs } from './transcript-reading';

describe('transcriptParagraphs', () => {
	it('turns timestamped ASR segments into continuous reading text', () => {
		const paragraphs = transcriptParagraphs([
			{ start: 0, text: '  первая   часть фразы ' },
			{ start: 3.2, text: 'и её продолжение.' },
			{ start: 8.1, text: 'следующая мысль' }
		]);

		expect(paragraphs).toEqual(['Первая часть фразы и её продолжение. Следующая мысль.']);
	});

	it('removes only explicit non-speech markers and normalizes punctuation spacing', () => {
		const paragraphs = transcriptParagraphs([
			{ start: 0, text: '[музыка]' },
			{ start: 2, text: '  вот , собственно , важная мысль .' },
			{ start: 5, text: '(аплодисменты)' }
		]);

		expect(paragraphs).toEqual(['Вот, собственно, важная мысль.']);
	});

	it('splits long speech into readable paragraphs without dropping words', () => {
		const segments = Array.from({ length: 18 }, (_, index) => ({
			start: index * 4,
			text: `${index > 0 && index % 4 === 0 ? 'например ' : ''}фрагмент ${index + 1} с несколькими важными словами для проверки`
		}));
		const paragraphs = transcriptParagraphs(segments);
		const joined = paragraphs.join(' ').toLowerCase();

		expect(paragraphs.length).toBeGreaterThan(1);
		for (let index = 1; index <= 18; index += 1) {
			expect(joined).toContain(`фрагмент ${index} `);
		}
	});

	it('splits a single long ASR segment on sentence boundaries', () => {
		const paragraphs = transcriptParagraphs([{
			start: 0,
			text: 'Первая мысль подробно объясняет исходную проблему и задаёт контекст для слушателя. Вторая мысль показывает конкретный пример и помогает увидеть изменение движения. Третья мысль связывает этот пример с результатом в бою и объясняет, почему это важно. Четвёртая мысль завершает рассуждение практическим выводом для тренировки.'
		}]);

		expect(paragraphs.length).toBeGreaterThan(1);
		expect(paragraphs.join(' ')).toContain('Четвёртая мысль');
	});

	it('keeps source timings while building readable paragraphs', () => {
		const paragraphs = timedTranscriptParagraphs([
			{ start: 12, text: 'первая фраза продолжается' },
			{ start: 16.5, text: 'и заканчивается.' },
			{ start: 21, text: 'следующая мысль' }
		]);

		expect(paragraphs).toHaveLength(1);
		expect(paragraphs[0].spans).toEqual([
			{ start: 12, text: 'Первая фраза продолжается' },
			{ start: 16.5, text: 'и заканчивается.' },
			{ start: 21, text: 'Следующая мысль.' }
		]);
	});

	it('keeps one clickable phrase when a source segment is split for reading', () => {
		const paragraphs = timedTranscriptParagraphs([
			{ start: 5, text: 'И поэтому мы переходим к следующему примеру.' }
		]);

		expect(paragraphs[0].spans).toEqual([
			{ start: 5, text: 'И поэтому мы переходим к следующему примеру.' }
		]);
	});
});

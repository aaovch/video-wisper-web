import { describe, expect, it } from 'vitest';
import { searchSnippet } from './search-snippet';

describe('source snippets', () => {
	it('prefers a passage covering several query terms over an early isolated word', () => {
		const text = 'Дистанция важна. ' + 'Обсуждаем другое упражнение. '.repeat(15) + 'Подготовка атаки требует контроля дистанции и темпа.';
		const result = searchSnippet(text, ['дистанция', 'подготовка', 'атака']);
		expect(result).toContain('Подготовка атаки');
		expect(text).toContain(result.replace(/^…|…$/g, ''));
	});
	it('does not crop words at either edge', () => {
		const text = 'Оченьдлинноесловобезпробелов '.repeat(12) + 'дистанция ' + 'Заключительноедлинноеслово '.repeat(8);
		const result = searchSnippet(text, ['дистанция']);
		const plain = result.replace(/^…|…$/g, '');
		const start = text.indexOf(plain);
		expect(start === 0 || /\s/.test(text[start - 1])).toBe(true);
		expect(start + plain.length === text.length || /\s/.test(text[start + plain.length])).toBe(true);
	});
	it('keeps the source unchanged, including ё and punctuation', () => {
		const text = 'Приём — подойти, ещё раз проверить дистанцию.';
		expect(searchSnippet(text, ['прием'])).toBe(text);
	});
	it('returns an honest beginning when no query word occurs', () => {
		expect(searchSnippet('Атака на подготовку.', ['маска'])).toBe('Атака на подготовку.');
	});
});

import { expect, it } from 'vitest';
import { hasSearchQuery, searchWords, processSearchTerm } from './search-tokenizer.js';

it('keeps every number while excluding single-letter words and punctuation', () => {
	expect(searchWords('В тренировке 0, 1, 9 и 2026!')).toEqual(['тренировке', '0', '1', '9', '2026']);
	for (const number of ['0', '1', '9', '2026']) {
		expect(processSearchTerm(number)).toBe(number);
		expect(hasSearchQuery(number)).toBe(true);
	}
	expect(processSearchTerm('в')).toBeNull();
	expect(hasSearchQuery('!')).toBe(false);
});

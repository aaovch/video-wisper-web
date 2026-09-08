import { describe, expect, it } from 'vitest';
import { readSearchState, writeSearchState } from './search-url-state';

describe('search navigation state', () => {
	it('round-trips a Cyrillic query, multiple filters and expanded results', () => {
		const filters = { weapons: ['Сабля', 'Рапира'], sections: ['А & Б'], zones: [] };
		const url = writeSearchState(new URL('https://example.test/collections/c/'), 'дистанция + шаг', filters, true);
		expect(readSearchState(url, { weapons: [], sections: [], zones: [] })).toEqual({ query: 'дистанция + шаг', selections: filters, expanded: true });
	});
	it('keeps report origin, playback timestamp and chapter when editing the query', () => {
		const url = writeSearchState(new URL('https://example.test/reports/a/?q=old&from=c&t=155#ch-6'), 'new', {}, false);
		expect(url.searchParams.get('from')).toBe('c');
		expect(url.searchParams.get('t')).toBe('155');
		expect(url.hash).toBe('#ch-6');
	});
	it('clears obsolete filters and query without leaving duplicated values', () => {
		const url = writeSearchState(new URL('https://example.test/?q=old&results=all&filter.weapons=x&filter.zones=y'), '', { weapons: [] }, false);
		expect(url.search).toBe('');
	});
	it('ignores filters from another search scope', () => {
		const state = readSearchState(new URL('https://example.test/?filter.zones=chapters&filter.weapons=sword'), { zones: [] });
		expect(state.selections).toEqual({ zones: ['chapters'] });
	});
	it('does not mutate the incoming URL or default selections', () => {
		const url = new URL('https://example.test/?filter.weapons=sword');
		const defaults = { weapons: [] };
		readSearchState(url, defaults);
		writeSearchState(url, 'new', defaults, true);
		expect(url.searchParams.has('q')).toBe(false);
		expect(defaults).toEqual({ weapons: [] });
	});
});

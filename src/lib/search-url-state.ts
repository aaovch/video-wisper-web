import type { SearchFilterSelections } from './search-filters';

export function readSearchState(url: URL, defaults: SearchFilterSelections) {
	const selections = { ...defaults };
	for (const key of Object.keys(defaults)) selections[key] = url.searchParams.getAll(`filter.${key}`);
	return { query: url.searchParams.get('q') ?? '', selections, expanded: url.searchParams.get('results') === 'all' };
}

export function writeSearchState(url: URL, query: string, selections: SearchFilterSelections, expanded: boolean) {
	const next = new URL(url);
	for (const key of [...next.searchParams.keys()]) if (key.startsWith('filter.')) next.searchParams.delete(key);
	if (query) next.searchParams.set('q', query);
	else next.searchParams.delete('q');
	for (const [key, values] of Object.entries(selections)) for (const value of values) next.searchParams.append(`filter.${key}`, value);
	if (expanded) next.searchParams.set('results', 'all');
	else next.searchParams.delete('results');
	return next;
}

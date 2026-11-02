import { expect, it } from 'vitest';
import { groupCatalogCollections } from './catalog-groups';
import { collectionReportFacets, collectionReportsMatchingFacets } from './collection-facets';
import type { Collection } from './data/collections';

const collection: Collection = {
	slug: 'library', title: 'Any library', subtitle: '', catalogGroup: 'another-club', items: ['a', 'b'],
	facets: { authors: ['One', 'Two'], places: ['City'], weapons: ['Sword', 'Sabre'] },
	itemFacets: { a: { authors: ['One'], weapons: ['Sword'] }, b: { authors: ['Two'], weapons: [] } }
};

it('renders arbitrary registered catalog groups and preserves ungrouped collections', () => {
	const plain = { ...collection, slug: 'plain', catalogGroup: undefined };
	const result = groupCatalogCollections([collection, plain], [{ id: 'another-club', title: 'Another club', label: 'Library' }]);
	expect(result.groups[0].collections).toEqual([collection]);
	expect(result.standalone).toEqual([plain]);
	expect(groupCatalogCollections([collection], []).standalone).toEqual([collection]);
});

it('uses explicit per-report facets with inheritance and explicit empty overrides', () => {
	expect(collectionReportFacets(collection, 'a')).toEqual({ authors: ['One'], places: ['City'], weapons: ['Sword'] });
	expect(collectionReportsMatchingFacets(collection, { authors: ['One'] })).toEqual(['a']);
	expect(collectionReportsMatchingFacets(collection, { weapons: ['Sabre'] })).toEqual([]);
	expect(collectionReportsMatchingFacets(collection, { authors: ['Two'], weapons: ['Sword'] })).toEqual([]);
	expect(collectionReportsMatchingFacets(collection, { places: ['City'] })).toEqual(['a', 'b']);
	expect(collectionReportFacets(collection, 'outside')).toEqual({});
	expect(collectionReportsMatchingFacets({ ...collection, title: 'Two teaches Sabre' }, { authors: ['One'] })).toEqual(['a']);
});

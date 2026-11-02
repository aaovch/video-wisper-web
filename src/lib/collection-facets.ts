import type { Collection, CollectionFacets } from './data/collections';

export const facetKeys = ['authors', 'places', 'weapons'] as const;

/** Facets are explicit data; renaming report text cannot change a filter. */
export function collectionReportFacets(collection: Collection, slug: string): CollectionFacets {
	if (!collection.items.includes(slug)) return {};
	return { ...collection.facets, ...collection.itemFacets?.[slug] };
}

export function matchesSelectedFacets(facets: CollectionFacets, selections: Record<string, string[]>): boolean {
	return facetKeys.every(key => !selections[key]?.length || selections[key].some(value => facets[key]?.includes(value)));
}

export function collectionReportsMatchingFacets(collection: Collection, selections: Record<string, string[]>): string[] {
	return collection.items.filter(slug => matchesSelectedFacets(collectionReportFacets(collection, slug), selections));
}

export function buildReportFacetMap(collection: Collection | undefined, slugs: readonly string[]) {
	return new Map(slugs.map(slug => {
		const facets = collection ? collectionReportFacets(collection, slug) : {};
		return [slug, {
			authors: new Set(facets.authors ?? []),
			places: new Set(facets.places ?? []),
			weapons: new Set(facets.weapons ?? [])
		}];
	}));
}

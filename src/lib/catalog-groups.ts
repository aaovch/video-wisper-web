import groups from './data/catalog-groups.json';
import type { Collection } from './data/collections';

export interface CatalogGroup {
	id: string;
	label: string;
	title: string;
	description?: string;
}

export function groupCatalogCollections(collections: readonly Collection[], registry: readonly CatalogGroup[] = groups) {
	return {
		groups: registry.map(group => ({ ...group, collections: collections.filter(c => c.catalogGroup === group.id) }))
			.filter(group => group.collections.length > 0),
		standalone: collections.filter(c => !registry.some(group => group.id === c.catalogGroup))
	};
}

import { error } from '@sveltejs/kit';
import { getCollection, getCollectionSlugs, collectionReports } from '$lib/data/collections';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => {
	return getCollectionSlugs().map((slug) => ({ slug }));
};

export const load: PageLoad = ({ params }) => {
	const collection = getCollection(params.slug);
	if (!collection) {
		throw error(404, 'Коллекция не найдена');
	}
	return { collection, reports: collectionReports(collection) };
};

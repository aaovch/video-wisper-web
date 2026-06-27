import { error } from '@sveltejs/kit';
import { getReport, getSlugs } from '$lib/data';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => {
	return getSlugs().map((slug) => ({ slug }));
};

export const load: PageLoad = async ({ params }) => {
	const report = await getReport(params.slug);
	if (!report) {
		throw error(404, 'Отчёт не найден');
	}
	return { report };
};

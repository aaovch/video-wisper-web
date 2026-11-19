import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { communityArchive } from '$lib/site';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	if (communityArchive) redirect(307, base + '/' + url.search + url.hash);
};

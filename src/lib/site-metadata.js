/** Shared by the browser and the server response seen by link crawlers. */
export const archiveSite = {
	name: 'HEMA-архив',
	tagline: 'Видео об историческом фехтовании',
	description: 'Тренировки, семинары и разборы боёв по историческому фехтованию. Ищите приёмы в главах и расшифровках и переходите к нужному моменту видео.',
	origin: 'https://hema-archive.com'
};

export const socialImage = '/social-preview-v1.png';
export const socialImageAlt = 'HEMA-архив — видео об историческом фехтовании';

/** Strip search state, passwords and timecodes from the public page identity.
 * @param {string} pathname
 * @param {string} origin
 */
export function canonicalUrl(pathname, origin) {
	const url = new URL(origin);
	url.pathname = pathname.endsWith('/') ? pathname : pathname + '/';
	url.search = '';
	url.hash = '';
	return url.href;
}

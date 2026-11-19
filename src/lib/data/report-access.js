/** @typedef {import('./collections').Collection} Collection */
/** @typedef {import('./collections').AccessTarget} AccessTarget */

/** Older catalogs gate collection entry with protectedReports.
 * @param {Collection[]} rows @returns {Collection[]}
 */
export function normalizeCollections(rows) {
	return rows.map(row => row.private === undefined && row.protectedReports === true
		? { ...row, private: true } : row);
}

/** Internal material never has a public synopsis, including in another collection. */
/** @param {string} slug @param {readonly Collection[]} source */
export function isPrivateReport(slug, source) {
	return source.some((collection) => collection.private && collection.items.includes(slug));
}

/** @param {Collection} collection @returns {AccessTarget | undefined} */
export function collectionMasterTarget(collection) {
	const master = collection.access?.master;
	if (!master) return undefined;
	return {
		...master,
		kind: 'master',
		collectionSlug: collection.slug,
		title: collection.title
	};
}

/** @param {string} slug @param {readonly Collection[]} source @returns {AccessTarget[]} */
export function resolveReportGate(slug, source) {
	const memberships = source.filter((collection) => collection.items.includes(slug));
	// An internal recording keeps its own grants even when linked from a public collection.
	const internal = memberships.filter((collection) => collection.private);
	const containing = internal.length ? internal : memberships;
	if (containing.length === 0) return [];
	const masters = containing
		.map(collectionMasterTarget)
		.filter((target) => target !== undefined);
	const passes = containing.flatMap((collection) =>
		(collection.access?.passes ?? [])
			.filter((pass) => pass.items.includes(slug))
			.map((pass) => ({
				...pass,
				kind: /** @type {const} */ ('pass'),
				collectionSlug: collection.slug
			}))
	);
	if (passes.length > 0) return [...masters, ...passes];
	if (
		!containing.some((collection) => (collection.private || collection.protectedReports) && collection.access?.master) &&
		containing.some((collection) => !collection.access?.master)
	) return [];
	return masters;
}

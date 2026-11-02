/**
 * Reports from other topics stay available by direct URL, outside the HEMA catalog and search.
 * A report also included in a HEMA collection remains discoverable.
 * Shared by the client and index build so local and global search use the same rule.
 * @param {readonly { hema?: boolean; items: readonly string[] }[]} collections
 */
export function hiddenTopicReportSlugs(collections) {
	const hema = new Set(collections.filter(collection => collection.hema).flatMap(collection => collection.items));
	return new Set(collections.filter(collection => !collection.hema)
		.flatMap(collection => collection.items).filter(slug => !hema.has(slug)));
}

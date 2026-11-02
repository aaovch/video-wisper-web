// Weapon names in the question constrain its context. Semantic expansions may
// retrieve a different weapon, but should not make it outrank that context.
const weaponNames = [
	/^(?:меч(?:а|у|ом|е|и|ей|ам|ами|ах)?|лонгсворд\p{L}*|longswords?)$/u,
	/^(?:рапир\p{L}*|rapiers?)$/u,
	/^(?:саб(?:л|ель)\p{L}*|sabres?|sabers?)$/u,
	/^(?:катан\p{L}*|katanas?)$/u
];

const weaponCache = new Map<string, number[]>();

function weapons(text: string): number[] {
	const cached = weaponCache.get(text);
	if (cached) return cached;
	const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
	const found = weaponNames.flatMap((pattern, i) => words.some(word => pattern.test(word)) ? [i] : []);
	// A query and report metadata recur for every candidate. Bound the cache for
	// long browser sessions without repeating tokenization for each result.
	if (weaponCache.size >= 256) weaponCache.delete(weaponCache.keys().next().value!);
	weaponCache.set(text, found);
	return found;
}

export function weaponMatchMultiplier(query: string, reportMetadata: string): number {
	const requested = weapons(query);
	const actual = weapons(reportMetadata);
	return requested.length && actual.length && !requested.some(weapon => actual.includes(weapon)) ? 0.6 : 1;
}

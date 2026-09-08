import { stemRu } from './stem-ru';

/** An unchanged slice of the source, chosen for query coverage, never generated prose. */
export function searchSnippet(text: string, terms: readonly string[], max = 180): string {
	const normalize = (word: string) => stemRu(word.toLowerCase().replace(/ё/g, 'е'));
	const stems = new Set(terms.flatMap(term => term.match(/[\p{L}\p{N}]+/gu) ?? []).map(normalize));
	const words = [...text.matchAll(/[\p{L}\p{N}]+/gu)];
	const matches = words.filter(word => stems.has(normalize(word[0])));
	let start = 0;
	let end = Math.min(text.length, max);
	let best = -1;
	for (const match of matches) {
		const from = Math.max(0, match.index - 45);
		const to = Math.min(text.length, from + max);
		const nearby = matches.filter(word => word.index >= from && word.index + word[0].length <= to);
		const score = new Set(nearby.map(word => normalize(word[0]))).size * 100 + nearby.length;
		if (score > best) { best = score; start = from; end = to; }
	}
	// Expand rather than cut a word in half. This keeps the displayed text verbatim.
	for (const word of words) {
		const wordEnd = word.index + word[0].length;
		if (word.index < start && wordEnd > start) start = word.index;
		if (word.index < end && wordEnd > end) end = wordEnd;
	}
	return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

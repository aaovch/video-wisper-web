export interface HighlightPart {
	text: string;
	match: boolean;
}

function words(query: string): string[] {
	return query
		.toLowerCase()
		.replace(/ё/g, 'е')
		.split(/[^\p{L}\p{N}]+/u)
		.filter((word) => word.length >= 3)
		.sort((a, b) => b.length - a.length);
}

/** Безопасно делит обычный текст на части для подсветки без {@html}. */
export function highlightParts(text: string, query: string): HighlightPart[] {
	const terms = words(query);
	if (!terms.length) return [{ text, match: false }];

	const queryStems = new Set(terms.map(stemRu));
	const re = /([\p{L}\p{N}]+)/gu;
	return text
		.split(re)
		.filter(Boolean)
		.map((part) => ({
			text: part,
			match: queryStems.has(stemRu(part.toLowerCase().replace(/ё/g, 'е')))
		}));
}
import { stemRu } from '$lib/stem-ru';

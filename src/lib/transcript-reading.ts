import type { TranscriptSegment } from '$lib/types';

const SENTENCE_END = /[.!?…][»”"')\]]?$/u;
const BRACKETED_NOISE = /^[[(].*(?:музык|аплодис|смех|шум|неразборчив|music|applause|laughter).*?[\])]$/iu;
const BARE_NOISE = /^(?:музыка|аплодисменты?|смех|шум|неразборчиво|music|applause|laughter)[.!…]*$/iu;
const NATURAL_BOUNDARY = /(?<=[.!?…])\s+|\s+(?=(?:смотрите|например|на самом деле|то есть|поэтому|при этом|дальше|теперь|в итоге|отсюда|с другой стороны)(?=\s|[,.:;!?…]|$))/giu;

function cleanSegment(text: string): string {
	return text
		.replace(/\s+/gu, ' ')
		.replace(/\s+([,.;:!?…])/gu, '$1')
		.replace(/([«„(])\s+/gu, '$1')
		.trim();
}

function isNoiseMarker(text: string): boolean {
	return BRACKETED_NOISE.test(text) || BARE_NOISE.test(text);
}

function capitalizeSentences(text: string): string {
	return text.replace(/(^|[.!?…]\s+)([«„"']*)(\p{Ll})/gu, (_match, boundary, quote, letter) =>
		`${boundary}${quote}${letter.toUpperCase()}`
	);
}

function finishParagraph(text: string): string {
	const capitalized = capitalizeSentences(text.trim());
	return SENTENCE_END.test(capitalized) ? capitalized : `${capitalized}.`;
}

/**
 * Собирает короткие ASR-сегменты в спокойные читательские абзацы.
 * Меняется только представление: слова и порядок речи остаются исходными.
 */
export function transcriptParagraphs(segments: TranscriptSegment[]): string[] {
	const texts = segments
		.map((segment) => cleanSegment(segment.text))
		.filter((text) => text.length > 0 && !isNoiseMarker(text));
	if (!texts.length) return [];

	const units = texts.join(' ').split(NATURAL_BOUNDARY).filter(Boolean);
	const paragraphs: string[] = [];
	let current = '';

	for (const unit of units) {
		const candidate = current ? `${current} ${unit}` : unit;
		if (candidate.length > 320 && current.length >= 150) {
			paragraphs.push(finishParagraph(current));
			current = unit;
		} else {
			current = candidate;
		}
	}

	if (current) paragraphs.push(finishParagraph(current));
	return paragraphs;
}

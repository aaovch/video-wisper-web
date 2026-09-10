import type { TranscriptSegment } from '$lib/types';

export interface ReadableTranscriptSpan {
	start: number;
	text: string;
}

export interface ReadableTranscriptParagraph {
	spans: ReadableTranscriptSpan[];
}

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

function finishTimedParagraph(units: ReadableTranscriptSpan[]): ReadableTranscriptParagraph {
	const raw = units.map((unit) => unit.text).join(' ');
	const formatted = finishParagraph(raw);
	let offset = 0;
	const timedSpans = units.map((unit, index) => {
		const end = offset + unit.text.length;
		const text = index === units.length - 1
			? formatted.slice(offset)
			: formatted.slice(offset, end);
		offset = end + 1;
		return { start: unit.start, text };
	});
	const spans: ReadableTranscriptSpan[] = [];

	for (const span of timedSpans) {
		const previous = spans[spans.length - 1];
		if (previous?.start === span.start) previous.text += ` ${span.text}`;
		else spans.push({ ...span });
	}

	return { spans };
}

/**
 * Та же читательская разбивка, но с привязкой каждой фразы к исходному времени.
 * Она нужна для синхронной подсветки и перемотки без показа таймкодов в тексте.
 */
export function timedTranscriptParagraphs(segments: TranscriptSegment[]): ReadableTranscriptParagraph[] {
	const units = segments.flatMap((segment) => {
		const text = cleanSegment(segment.text);
		if (!text || isNoiseMarker(text)) return [];
		return text
			.split(NATURAL_BOUNDARY)
			.map((part) => cleanSegment(part))
			.filter(Boolean)
			.map((part) => ({ start: segment.start, text: part }));
	});
	if (!units.length) return [];

	const paragraphs: ReadableTranscriptParagraph[] = [];
	let current: ReadableTranscriptSpan[] = [];
	let currentLength = 0;

	for (const unit of units) {
		const candidateLength = currentLength + (current.length ? 1 : 0) + unit.text.length;
		if (candidateLength > 320 && currentLength >= 150) {
			paragraphs.push(finishTimedParagraph(current));
			current = [unit];
			currentLength = unit.text.length;
		} else {
			current.push(unit);
			currentLength = candidateLength;
		}
	}

	if (current.length) paragraphs.push(finishTimedParagraph(current));
	return paragraphs;
}

/**
 * Собирает короткие ASR-сегменты в спокойные читательские абзацы.
 * Меняется только представление: слова и порядок речи остаются исходными.
 */
export function transcriptParagraphs(segments: TranscriptSegment[]): string[] {
	return timedTranscriptParagraphs(segments)
		.map((paragraph) => paragraph.spans.map((span) => span.text).join(' '));
}

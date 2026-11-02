import { stemRu } from './stem-ru.js';

export const STOP_WORDS = new Set([
	'а', 'без', 'бы', 'был', 'была', 'были', 'было', 'быть', 'в', 'вам', 'вас', 'весь', 'во',
	'вот', 'все', 'всего', 'вы', 'где', 'да', 'для', 'до', 'его', 'ее', 'если', 'есть', 'еще',
	'же', 'за', 'и', 'из', 'или', 'им', 'их', 'к', 'как', 'какая', 'какие', 'какой', 'когда',
	'который', 'кто', 'ли', 'мне', 'можно', 'мы', 'на', 'над', 'надо', 'наш', 'не', 'него',
	'нее', 'нет', 'ни', 'но', 'ну', 'о', 'об', 'один', 'он', 'она', 'они', 'оно', 'от', 'по',
	'под', 'при', 'про', 'против', 'с', 'со', 'так', 'такой', 'там', 'то', 'того', 'тоже', 'только', 'у',
	'уже', 'что', 'чтобы', 'это', 'этот', 'я'
]);

/** @param {string} value */
export function normalizeSearchText(value) {
	return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/** Numbers, including a single digit, are always meaningful tokens. @param {string} token */
export function isSearchToken(token) {
	return token.length >= 2 || /^\d+$/.test(token);
}

/** @param {string} text */
export function searchWords(text) {
	return (normalizeSearchText(text).match(/[\p{L}\p{N}]+/gu) ?? []).filter(isSearchToken);
}

/** Shared by index creation and browser queries. @param {string} term */
export function processSearchTerm(term) {
	const token = normalizeSearchText(term).replace(/[^\p{L}\p{N}]/gu, '');
	return isSearchToken(token) && !STOP_WORDS.has(token) ? stemRu(token) : null;
}

/** @param {string} query */
export function hasSearchQuery(query) {
	return query.trim().length >= 2 || /^\d$/.test(query.trim());
}

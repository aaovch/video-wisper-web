/**
 * Лёгкий стеммер русского языка (порт Snowball Russian / Porter).
 * Вендорится без зависимости: нужен только для нормализации терминов
 * при индексировании и в запросе — симметрично, поэтому абсолютная
 * лингвистическая точность не требуется, важна одинаковая обрезка окончаний.
 *
 * Латиница/цифры и прочее не трогаются — стеммим только кириллические слова.
 */

const RV = /^(.*?[аеиоуыэюя])(.*)$/;

// $-якорь => совпадение всегда одно, флаг /g не нужен (и опасен из-за lastIndex).
const PERFECTIVE_GERUND = /(ив|ивши|ившись|ыв|ывши|ывшись|(?<=[ая])(?:в|вши|вшись))$/;
const REFLEXIVE = /с[яь]$/;
const ADJECTIVE =
	/(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/;
const PARTICIPLE = /(ивш|ывш|ующ|(?<=[ая])(?:ем|нн|вш|ющ|щ))$/;
const VERB =
	/(ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ую|ю|(?<=[ая])(?:ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно))$/;
const NOUN =
	/(а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|ия|ья|я)$/;
const SUPERLATIVE = /(ейше|ейш)$/;
const DERIVATIONAL = /(ость|ост)$/;
const TRAILING_I = /и$/;
const SOFT_SIGN = /ь$/;
const DOUBLE_N = /нн$/;

const CYRILLIC = /[а-яё]/;

export function stemRu(token: string): string {
	const word = token.toLowerCase().replace(/ё/g, 'е');
	if (!CYRILLIC.test(word) || word.length < 3) return word;

	const m = RV.exec(word);
	if (!m) return word;

	const head = m[1];
	let rv = m[2];

	// Шаг 1: совершенный деепричастный → иначе возвратный + (прилаг|глагол|сущ).
	const afterGerund = rv.replace(PERFECTIVE_GERUND, '');
	if (afterGerund !== rv) {
		rv = afterGerund;
	} else {
		rv = rv.replace(REFLEXIVE, '');
		const afterAdj = rv.replace(ADJECTIVE, '');
		if (afterAdj !== rv) {
			rv = afterAdj.replace(PARTICIPLE, '');
		} else {
			const afterVerb = rv.replace(VERB, '');
			rv = afterVerb !== rv ? afterVerb : rv.replace(NOUN, '');
		}
	}

	// Шаг 2: финальное «и».
	rv = rv.replace(TRAILING_I, '');

	// Шаг 3: производное (-ость/-ост).
	rv = rv.replace(DERIVATIONAL, '');

	// Шаг 4: удвоенное «нн» → «н» | превосходная степень | мягкий знак.
	if (DOUBLE_N.test(rv)) {
		rv = rv.slice(0, -1);
	} else if (SUPERLATIVE.test(rv)) {
		rv = rv.replace(SUPERLATIVE, '');
		if (DOUBLE_N.test(rv)) rv = rv.slice(0, -1);
	} else {
		rv = rv.replace(SOFT_SIGN, '');
	}

	return head + rv;
}

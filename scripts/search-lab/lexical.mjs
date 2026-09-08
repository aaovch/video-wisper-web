import MiniSearch from 'minisearch';
import { stemRu } from '../../src/lib/stem-ru.js';

// Research-only alternatives. No browser import or production default is changed.
const stop = new Set('а без бы был была были было быть в вам вас весь во вот все всего вы где да для до его ее если есть еще же за и из или им их к как какая какие какой когда который кто ли мне можно мы на над надо наш не него нее нет ни но ну о об один он она они оно от по под при про против с со так такой там то того тоже только у уже что чтобы это этот я почему зачем чем сколько делать'.split(' '));
export const terms = text => [...new Set((text.toLowerCase().replace(/ё/g, 'е').match(/[\p{L}\p{N}]+/gu) ?? [])
	.filter(t => t.length >= 2 && !stop.has(t)).map(stemRu))];
const processTerm = term => terms(term)[0] ?? null;

export function buildLexical(corpus, contextual = false) {
	const index = new MiniSearch({ fields: ['title', 'body', 'context'], storeFields: ['reportSlug'], processTerm });
	index.addAll(corpus.map(d => ({ ...d, context: contextual ? d.context : '' })));
	return { index, bytes: Buffer.byteLength(JSON.stringify(index)), search(query, allowed, coverage = false) {
		const parsed = terms(query);
		if (!parsed.length) return [];
		const results = index.search(query, { combineWith: 'OR', boost: { title: 2, context: 0.65 },
			filter: result => allowed.has(result.reportSlug), fuzzy: false, prefix: false });
		if (coverage) {
			// Exact matched query terms; unlike the production snippet, this covers
			// the whole indexed chapter. Penalize single common-word matches.
			for (const r of results) r.score *= Math.pow(r.queryTerms.length / parsed.length, 2);
			results.sort((a, b) => b.score - a.score);
		}
		return results.slice(0, 100).map(r => ({ id: r.id, score: r.score }));
	} };
}

export function rrf(lists, k = 60) {
	const scores = new Map();
	for (const list of lists) list.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (k + i + 1)));
	return [...scores].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score).slice(0, 100);
}

export function metrics(ranking, relevant) {
	const ids = [...new Set(ranking.map(r => r.id))];
	const grade = new Set(relevant);
	const rank = ids.findIndex(id => grade.has(id)) + 1;
	const dcg = ids.slice(0, 10).reduce((sum, id, i) => sum + (grade.has(id) ? 1 / Math.log2(i + 2) : 0), 0);
	const ideal = Array.from({ length: Math.min(10, grade.size) }, (_, i) => 1 / Math.log2(i + 2)).reduce((a, b) => a + b, 0);
	return { rank, hit1: +(rank === 1), hit3: +(rank > 0 && rank <= 3), hit5: +(rank > 0 && rank <= 5),
		mrr10: rank && rank <= 10 ? 1 / rank : 0, ndcg10: ideal ? dcg / ideal : 0,
		recall10: grade.size ? ids.slice(0, 10).filter(id => grade.has(id)).length / grade.size : 0 };
}

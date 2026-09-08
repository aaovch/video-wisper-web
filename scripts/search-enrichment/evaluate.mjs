import MiniSearch from 'minisearch';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { terms, metrics } from '../search-lab/lexical.mjs';
import { readEnrichment, sourceHash } from './core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const corpus = read('.codex/search-lab/corpus.json');
const tasks = read('.codex/search-lab/tasks.json');
const expansions = new Map();
for (const slug of new Set(corpus.map(d => d.reportSlug))) {
	const report = read(`src/lib/data/reports/${slug}.json`);
	// Refuse comparisons against stale lab exports.
	for (const doc of corpus.filter(d => d.reportSlug === slug)) {
		const chapter = report.chapters[doc.chapterIndex];
		const body = [chapter.summary, ...(chapter.theses ?? [])].filter(Boolean).join(' ');
		if (doc.title !== chapter.title || doc.body !== body || doc.context !== report.title) throw new Error(`Stale corpus: ${doc.id}; run test:search-lab first`);
	}
	const data = readEnrichment(root, report);
	for (const entry of data?.chapters ?? []) expansions.set(`${slug}:chapter:${entry.chapterIndex}`, entry);
}
const systems = ['chapter-original', 'chapter-context', 'chapter-context-questions'];
const rows = [];
const sizes = {};
for (const system of systems) {
	const index = new MiniSearch({ fields: ['title', 'body', 'context', 'questions'], storeFields: ['reportSlug'], processTerm: term => terms(term)[0] ?? null });
	index.addAll(corpus.map(doc => {
		const entry = expansions.get(doc.id);
		return { ...doc, context: [doc.context, system !== 'chapter-original' ? entry?.context.text : ''].filter(Boolean).join(' '),
			questions: system === 'chapter-context-questions' ? (entry?.questions ?? []).map(q => q.text).join(' ') : '' };
	}));
	sizes[system] = Buffer.byteLength(JSON.stringify(index));
	for (const task of tasks) {
		const allowed = new Set(task.allowed);
		const ranking = index.search(task.query, { combineWith: 'OR', fuzzy: false, prefix: false,
			boost: { title: 2, context: 0.65, questions: 0.8 }, filter: r => allowed.has(r.reportSlug) })
			.slice(0, 100).map(r => ({ id: r.id, score: r.score }));
		rows.push({ id: task.id, split: task.split, variant: task.variant, scope: task.scope,
			pilot: task.relevant.some(id => expansions.has(id)), system, query: task.query,
			negative: task.relevant.length === 0, ...metrics(ranking, task.relevant), ranking });
	}
}
const groups = [];
for (const population of ['all', 'pilot', 'unmodified', 'negative']) for (const scope of ['report', 'collection', 'archive']) for (const system of systems) {
	const selected = rows.filter(r => r.system === system && r.scope === scope &&
		(population === 'negative' ? r.negative : !r.negative && (population === 'all' || (population === 'pilot' ? r.pilot : !r.pilot))));
	if (!selected.length) continue;
	groups.push({ population, scope, system, count: selected.length,
		hit3: selected.reduce((sum,r) => sum+r.hit3,0), hit5: selected.reduce((sum,r) => sum+r.hit5,0),
		mrr10: selected.reduce((sum,r) => sum+r.mrr10,0)/selected.length,
		nonempty: selected.filter(r => r.ranking.length).length });
}
const summary = { protocol: 'Exploratory: fixed existing questions were NOT used as expansion text; author has seen earlier evaluations. No new independent holdout claim. Fixed weights title=2/context=.65/questions=.8; OR, no fuzzy. Partial-corpus pilot. All query variants included; report metrics are chapter retrieval, not full UI.',
	chapters: corpus.length, enriched: expansions.size, corpusHash: sourceHash(corpus), tasksHash: sourceHash(tasks), expansionHash: sourceHash([...expansions]), sizes, groups };
mkdirSync(resolve(root, '.codex/search-enrichment'), { recursive: true });
writeFileSync(resolve(root, '.codex/search-enrichment/evaluation.json'), JSON.stringify({ summary, rows }, null, 2)+'\n');
mkdirSync(resolve(root, 'docs/search-quality/enrichment-pilot'), { recursive: true });
writeFileSync(resolve(root, 'docs/search-quality/enrichment-pilot/results.json'), JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));

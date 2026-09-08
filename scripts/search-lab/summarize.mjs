import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? '.codex/search-lab';
const read = name => JSON.parse(readFileSync(join(root, `${name}.json`), 'utf8'));
const includeNeural = !process.argv.includes('--lexical-only');
const neuralManifest = includeNeural && existsSync(join(root, 'neural-manifest.json')) ? read('neural-manifest') : null;
if (neuralManifest) for (const key of ['corpusHash', 'questionsHash', 'productionIndexHash']) {
	if (neuralManifest.sourceManifest?.[key] !== read('manifest')[key]) {
		throw new Error(`Stale neural results (${key}); rerun with --neural or use a fresh SEARCH_LAB_DIR`);
	}
}
const tasks = new Map(read('tasks').map(t => [t.id, t]));
const rows = [...read('lexical'), ...(includeNeural && existsSync(join(root, 'neural.json')) ? read('neural') : [])]
	.map(row => ({ ...row, ...Object.fromEntries(Object.entries(tasks.get(row.task)).filter(([k]) =>
		['query', 'queryId', 'family', 'split', 'variant', 'scope'].includes(k))) }));
const systems = [...new Set(rows.map(r => r.system))];
const mean = (list, key) => list.reduce((s, r) => s + r[key], 0) / list.length;
const rounded = value => Number(value.toFixed(4));
const summaries = [];
for (const split of ['development', 'holdout']) for (const variant of ['natural', 'typo', 'paraphrase']) {
	for (const scope of ['report', 'collection', 'archive']) for (const system of systems) {
		const subset = rows.filter(r => r.split === split && r.variant === variant && r.scope === scope && r.system === system);
		if (!subset.length) continue;
		summaries.push({ split, variant, scope, system, n: subset.length,
			...Object.fromEntries(['hit1', 'hit3', 'hit5', 'mrr10', 'ndcg10', 'recall10'].map(k => [k, rounded(mean(subset, k))])) });
	}
}
// Paired, family-level bootstrap on natural holdout questions only. Do not
// pretend typo variants of the same question are independent observations.
let seed = 20260906;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }
const paired = [];
for (const system of systems.filter(s => s !== 'current')) {
	const baseline = rows.filter(r => r.system === 'current' && r.split === 'holdout' && r.variant === 'natural' && r.scope === 'archive');
	const candidate = new Map(rows.filter(r => r.system === system).map(r => [r.task, r]));
	for (const metric of ['hit3', 'mrr10', 'ndcg10']) {
		const differences = baseline.map(r => candidate.get(r.task)[metric] - r[metric]);
		const samples = Array.from({ length: 5000 }, () => differences.reduce(sum => sum + differences[Math.floor(random() * differences.length)], 0) / differences.length).sort((a, b) => a - b);
		paired.push({ system, metric, n: differences.length, delta: rounded(differences.reduce((a, b) => a + b, 0) / differences.length),
			ci95: [rounded(samples[125]), rounded(samples[4874])],
			wins: differences.filter(d => d > 0).length, losses: differences.filter(d => d < 0).length });
	}
}
const negatives = systems.map(system => {
	const subset = rows.filter(r => r.system === system && r.split === 'negative');
	return { system, n: subset.length, returnedAny: subset.filter(r => r.returned > 0).length,
		queries: subset.map(r => ({ query: r.query, returned: r.returned, top: r.top.slice(0, 3) })) };
});
const latency = systems.filter(s => !s.includes('e5') && !s.includes('rrf')).map(system => {
	const times = rows.filter(r => r.system === system && r.scope === 'archive').map(r => r.ms).sort((a, b) => a - b);
	return { system, n: times.length, medianMs: rounded(times[Math.floor(times.length / 2)]), p95Ms: rounded(times[Math.floor(times.length * 0.95)]) };
});
const abstention = systems.includes('rrf-jina-rerank20') ? [-3, -2, -1, 0, 1].map(threshold => ({ threshold,
	...Object.fromEntries(['development', 'holdout', 'negative'].map(split => {
		const subset = rows.filter(r => r.system === 'rrf-jina-rerank20' && r.scope === 'archive' && r.split === split
			&& (r.variant === 'natural' || split === 'negative'));
		const accepted = subset.filter(r => r.top.length && r.top[0].score >= threshold);
		return [split, { n: subset.length, accepted: accepted.length, hit3AfterGate: accepted.reduce((s, r) => s + r.hit3, 0) }];
	}))
})) : [];
const result = { manifest: read('manifest'), summaries, paired, negatives, latency,
	neural: neuralManifest, abstention };
writeFileSync(join(root, 'abstention.json'), JSON.stringify(abstention, null, 2) + '\n');
writeFileSync(join(root, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
writeFileSync(join(root, 'results.json'), JSON.stringify(rows, null, 2) + '\n');
let md = '# Search Lab: измеренные результаты\n\n';
for (const split of ['development', 'holdout']) for (const variant of ['natural', 'typo', 'paraphrase']) {
	md += `## ${split} / ${variant} / archive\n\n| Вариант | N | Hit@1 | Hit@3 | Hit@5 | MRR@10 | nDCG@10 | Recall@10 |\n|---|---:|---:|---:|---:|---:|---:|---:|\n`;
	for (const row of summaries.filter(r => r.split === split && r.variant === variant && r.scope === 'archive')) {
		md += `| ${row.system} | ${row.n} | ${row.hit1} | ${row.hit3} | ${row.hit5} | ${row.mrr10} | ${row.ndcg10} | ${row.recall10} |\n`;
	}
	md += '\n';
}
md += '## Парные сравнения с current: только natural holdout / archive\n\n| Вариант | Метрика | Изменение | Bootstrap 95% CI | Улучшений / ухудшений |\n|---|---|---:|---|---|\n';
for (const row of paired) md += `| ${row.system} | ${row.metric} | ${row.delta} | ${row.ci95.join(' … ')} | ${row.wins} / ${row.losses} |\n`;
md += '\nИнтервалы описывают эти 24 синтетических семейства вопросов, не реальный пользовательский трафик. Разметка релевантности неполная. Неразмеченные документы считаются нерелевантными только для расчёта метрик.\n';
writeFileSync(join(root, 'results.md'), md);
console.log(md);

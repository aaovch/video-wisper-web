import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { it, expect, vi } from 'vitest';
import { searchScoped, resetSearchIndex, whenSearchComplete } from '$lib/search-core';
import { searchableReportSlugs } from '$lib/search-visibility';
import { collections } from '$lib/data/collections';
import type { SearchScope, SearchHit } from '$lib/search-types';
import dev from '../../src/lib/search-quality-cases.json';
import holdout from './holdout.json';
import { buildLexical, metrics } from './lexical.mjs';

const enabled = process.env.SEARCH_LAB === '1';
const output = process.env.SEARCH_LAB_DIR ?? '.codex/search-lab';
const key = (hit: SearchHit) => hit.chapterIndex != null ? `${hit.reportSlug}:chapter:${hit.chapterIndex}`
	: `${hit.reportSlug}:${hit.kind === 'overview' || hit.kind === 'report' ? hit.kind : `${hit.zone}:${hit.title}`}`;

it.skipIf(!enabled)('compares retrieval and scope behavior on frozen development and holdout questions', async () => {
	mkdirSync(output, { recursive: true });
	const visible = searchableReportSlugs([], 'all');
	const reports = readdirSync('src/lib/data/reports').filter(f => f.endsWith('.json')).sort()
		.map(f => JSON.parse(readFileSync(`src/lib/data/reports/${f}`, 'utf8')));
	const corpus = reports.filter(r => visible.includes(r.slug)).flatMap(r => r.chapters.map((c: any, i: number) => ({
		id: `${r.slug}:chapter:${i}`, reportSlug: r.slug, chapterIndex: i, title: c.title,
		body: [c.summary, ...(c.theses ?? [])].filter(Boolean).join(' '),
		context: r.title, start: c.start
	})));
	const base = [...dev.map(q => ({ ...q, split: 'development' })), ...holdout];
	for (const q of base) {
		const report = reports.find(r => r.slug === q.reportSlug);
		expect(visible).toContain(q.reportSlug);
		for (const e of q.evidence) {
			expect(report.chapters[e.chapterIndex].title).toBe(e.title);
			expect(report.chapters[e.chapterIndex].theses).toContain(e.quote);
		}
	}
	const queries = base.flatMap(q => {
		const words = q.query.match(/[\p{L}]{5,}/gu) ?? [];
		const longest = [...words].sort((a, b) => b.length - a.length)[0];
		const middle = Math.floor(longest.length / 2);
		const typo = longest.slice(0, middle) + longest.slice(middle + 1);
		return [{ ...q, variant: 'natural', family: q.id },
			{ ...q, id: `${q.id}-typo`, family: q.id, variant: 'typo', query: q.query.replace(longest, typo) }];
	});
	const paraphrases = [
		['q11', 'Сеты и повторы для ребёнка: какие числа взять за основу?'],
		['q22', 'Ученик выиграл соревнование. Значит ли это, что моя методика работает?'],
		['q14', 'Как проверить, что основание пальца не отрывается от пола?'],
		['q09', 'Правда ли штанга мешает ребёнку вырасти?'],
		['q06', 'Я складываю значения, хотя надо узнать, каких чисел больше. Что за ошибка?'],
		['q02', 'Можно ли хранить только знак каждой координаты эмбеддинга?'],
		['h01', 'Начало помнит, конец помнит, а данные посередине потерялись. Почему?'],
		['h08', 'Приём побеждает соперника, но суставам от него плохо. Такое возможно?'],
		['h14', 'Как отличить успех хотя бы одной попытки от успеха каждой попытки?'],
		['h16', 'Можно всем спортсменам поставить одну и ту же границу 4 ммоль/л?'],
		['h20', 'Почему маленький снаряд требует от мышц гораздо большего усилия?'],
		['h23', 'Закончил тяжёлую серию: замереть или немного походить?']
	];
	for (const [id, query] of paraphrases) {
		const q = base.find(q => q.id === id)!;
		queries.push({ ...q, id: `${id}-paraphrase`, family: id, variant: 'paraphrase', query });
	}
	const negatives = ['Как вырастить закваску левито мадре?', 'Как настроить квантовую телепортацию кубита?',
		'Сколько стоит абонемент NoName в 2035 году?', 'Какой прогноз курса тугрика на 2042 год?',
		'Где описан приём фехтования зюзюбра-91827?', 'жжжщщщ ыыыъъъ'];
	for (const [i, query] of negatives.entries()) queries.push({ ...base[0], id: `n${i + 1}`, family: `n${i + 1}`,
		split: 'negative', variant: 'absent', query, chapters: [], evidence: [] });

	const files = new Map(['index-core.json', 'index-transcripts.json', 'chapter-titles.json']
		.map(name => [name, readFileSync(`static/search/${name}`, 'utf8')]));
	resetSearchIndex();
	vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
		const body = files.get(String(input).split('/').pop()!);
		return new Response(body ?? '', { status: body === undefined ? 404 : 200 });
	}));
	try {
		const coldStart = performance.now();
		await searchScoped('поиск', [{ kind: 'archive', label: 'all', reportSlugs: visible }]);
		await whenSearchComplete();
		const coldMs = performance.now() - coldStart;
		const plain = buildLexical(corpus);
		const contextual = buildLexical(corpus, true);
		const tasks = [];
		const rows = [];
		for (const [i, q] of queries.entries()) {
			const collection = collections.find(c => c.items.includes(q.reportSlug) && !c.password)!;
			const scopes: SearchScope[] = q.split === 'negative'
				? [{ kind: 'archive', label: 'all', reportSlugs: visible }]
				: [{ kind: 'report', label: q.reportSlug, reportSlug: q.reportSlug },
					{ kind: 'collection', label: collection.slug, reportSlugs: collection.items.filter(s => visible.includes(s)) },
					{ kind: 'archive', label: 'all', reportSlugs: visible }];
			for (const scope of scopes) {
				const allowed = scope.kind === 'report' ? [scope.reportSlug] : [...scope.reportSlugs];
				const relevant = q.chapters.map(c => `${q.reportSlug}:chapter:${c}`);
				const task = { id: `${q.id}:${scope.kind}`, queryId: q.id, query: q.query, split: q.split, family: q.family,
					variant: q.variant, scope: scope.kind, allowed, relevant };
				tasks.push(task);
				const started = performance.now();
				const response = await searchScoped(q.query, [scope], scope.kind === 'archive' ? 30 : 120);
				const elapsed = performance.now() - started;
				const seen = new Set();
				const current = response.hits.filter(h => { const id = key(h); if (seen.has(id)) return false; seen.add(id); return true; })
					.map(h => ({ id: key(h), score: h.score }));
				expect(response.hits.every(h => allowed.includes(h.reportSlug))).toBe(true);
				const rankings: Record<string, any> = { current };
				rows.push({ task: task.id, system: 'current', ms: elapsed, ...metrics(current, relevant), returned: current.length,
					top: current.slice(0, 10), matchKind: response.matchKind });
				// Exploratory ablation added AFTER inspecting the first frozen run.
				// This does not count as independent holdout confirmation.
				const cleanQuery = q.query.replace(/[\p{L}\p{N}]+/gu, word =>
					['почему', 'зачем', 'чем', 'сколько', 'делать'].includes(word.toLowerCase()) ? '' : word).trim();
				const cleanStarted = performance.now();
				const cleanResponse = await searchScoped(cleanQuery, [scope], scope.kind === 'archive' ? 30 : 120);
				const cleanSeen = new Set();
				const cleanRanking = cleanResponse.hits.filter(h => { const id = key(h); if (cleanSeen.has(id)) return false; cleanSeen.add(id); return true; })
					.map(h => ({ id: key(h), score: h.score }));
				rankings['current-query-clean-exploratory'] = cleanRanking;
				rows.push({ task: task.id, system: 'current-query-clean-exploratory', ms: performance.now() - cleanStarted,
					...metrics(cleanRanking, relevant), returned: cleanRanking.length, top: cleanRanking.slice(0, 10) });
				for (const [name, search, coverage] of [
					['chapter-bm25', plain, false], ['context-bm25', contextual, false], ['context-coverage', contextual, true]
				] as const) {
					const started = performance.now();
					const ranking = search.search(q.query, new Set(allowed), coverage);
					rankings[name] = ranking;
					rows.push({ task: task.id, system: name, ms: performance.now() - started,
						...metrics(ranking, relevant), returned: ranking.length, top: ranking.slice(0, 10) });
				}
				Object.assign(task, { rankings });
			}
			if (i % 12 === 0) console.log(`search-lab: ${i + 1}/${queries.length} query variants`);
		}
		const manifest = { createdAt: new Date().toISOString(), corpusHash: createHash('sha256').update(JSON.stringify(corpus)).digest('hex'),
			questionsHash: createHash('sha256').update(JSON.stringify(queries)).digest('hex'),
			productionIndexHash: createHash('sha256').update([...files.values()].join('')).digest('hex'),
			reports: visible.length, chapters: corpus.length, questions: queries.length, tasks: tasks.length, coldMs,
			indexBytes: { plain: plain.bytes, contextual: contextual.bytes },
			exploratorySystems: ['current-query-clean-exploratory'],
			protocol: 'Frozen 24 development + 24 holdout families; parameters chosen before first holdout run. Binary incomplete chapter qrels. Negative questions only in archive.' };
		for (const [name, value] of Object.entries({ corpus, queries, tasks, lexical: rows, manifest })) {
			writeFileSync(`${output}/${name}.json`, JSON.stringify(value, null, 2) + '\n');
		}
		console.log(JSON.stringify(manifest, null, 2));
	} finally { resetSearchIndex(); vi.unstubAllGlobals(); }
}, 600000);

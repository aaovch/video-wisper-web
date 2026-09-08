import MiniSearch from 'minisearch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSearchIndex, searchScoped, searchReportExact, searchReportsExact, whenSearchComplete } from '$lib/search-core';
import { stemRu } from '$lib/stem-ru';
import type { SearchScope } from '$lib/search-types';

function shard(kind: string, text: string) {
	const mini = new MiniSearch({ fields: ['field_title', 'field_body', 'field_tags'],
		storeFields: ['kind', 'reportSlug', 'chapterIndex', 'text', 'title'],
		processTerm: term => stemRu(term.toLowerCase().replace(/ё/g, 'е')) });
	mini.add({ id: kind, kind, reportSlug: 'fixture', chapterIndex: 0, title: 'Подъёмы на носки', text,
		field_title: 'Подъёмы на носки', field_body: text, field_tags: '' });
	return JSON.stringify(mini);
}
const core = shard('chapter', 'Подъёмы на носки с опорой.');
const transcript = shard('transcript', 'Квазигармонический контроль движения.');
const scope: SearchScope = { kind: 'report', label: 'fixture', reportSlug: 'fixture' };

beforeEach(() => resetSearchIndex());
afterEach(() => { resetSearchIndex(); vi.unstubAllGlobals(); });

function serve(overrides: Partial<Record<string, () => Promise<Response>>> = {}) {
	const fetch = vi.fn(async (input: RequestInfo | URL) => {
		const name = String(input).split('/').pop()!;
		if (overrides[name]) return overrides[name]!();
		return new Response(name === 'index-core.json' ? core : name === 'index-transcripts.json' ? transcript : '{}');
	});
	vi.stubGlobal('fetch', fetch);
	return fetch;
}

describe('search fault injection and metamorphic contracts', () => {
	it('requires literal numbers across exact, prefix, correction and semantic results', async () => {
		serve({ 'index-core.json': async () => new Response(shard('chapter', 'Турнир 2026: правила соревнования и захват клинка.')),
			'index-transcripts.json': async () => new Response(shard('transcript', 'Занятие 2025 по правилам турнира.')) });
		for (const query of ['турнир 2099','турнир 202','Правила захвата крокозябр-82716','Расписание турнира на Марсе 2099']) {
			expect((await searchScoped(query,[scope])).hits,query).toEqual([]);
		}
		const exact=await searchScoped('турнир 2026',[scope]);
		expect(exact.hits[0]?.snippet).toContain('2026');
		const typo=await searchScoped('турнр 2026',[scope]);
		expect(typo.hits[0]?.snippet).toContain('2026');
		const question=await searchScoped('Какие правила турнира действуют в 2026 году?',[scope]);
		expect(question.hits.length).toBeGreaterThan(0);
		expect(question.hits.every(h=>h.snippet.includes('2026'))).toBe(true);
	});
	it('finds a canonical technique alias without fabricating an exact quote or crossing scopes', async () => {
		serve({ 'index-core.json': async () => new Response(shard('chapter', 'Разбираем цорнхау на занятии.')),
			'index-transcripts.json': async () => new Response(shard('transcript', 'Другой фрагмент.')) });
		const response = await searchScoped('zornhau', [scope]);
		expect(response.matchKind).toBe('semantic');
		expect(response.hits[0]?.snippet).toContain('цорнхау');
		expect(await searchReportExact('fixture', 'zornhau')).toEqual([]);
		expect((await searchScoped('zornhau', [{ ...scope, reportSlug: 'other' }])).hits).toEqual([]);
		expect((await searchScoped('zornhau', [{ ...scope, zones: ['transcript'] }])).hits).toEqual([]);
	});
	it('does not compute discarded fuzzy-AND corrections for long questions', async () => {
		serve();
		const spy = vi.spyOn(MiniSearch.prototype, 'search');
		try {
			const response = await searchScoped('подъёмы носки опора квазигармонический', [scope]);
			expect(response.hits.length).toBeGreaterThan(0);
			expect(spy.mock.calls.some(([, options]) => options?.combineWith === 'AND' && !!options.fuzzy)).toBe(false);
			expect(spy.mock.calls.some(([, options]) => options?.combineWith === 'OR' && !!options.fuzzy)).toBe(true);
			await whenSearchComplete();
		} finally { spy.mockRestore(); }
	});
	it.each([false, true])('keeps generated matches non-exact and scoped with indexed coverage=%s', async (indexedCoverage) => {
		const mini = new MiniSearch({ fields: ['field_title', 'field_body', 'field_tags', 'field_context', 'field_questions'],
			storeFields: ['kind', 'reportSlug', 'chapterIndex', 'text', 'title', 'signalTerms'],
			processTerm: term => stemRu(term.toLowerCase().replace(/ё/g, 'е')) });
		mini.add({ id: 'enriched', kind: 'chapter', reportSlug: 'fixture', chapterIndex: 0,
			title: 'Исходная глава', text: 'Подлинный текст главы.', field_body: 'Подлинный текст главы.',
			field_questions: 'Квазигармоническая адаптация',
			signalTerms: indexedCoverage ? ['квазигармоническая', 'адаптация'].map(stemRu).join(' ') : undefined });
		serve({ 'index-core.json': async () => new Response(JSON.stringify(mini)),
			'index-transcripts.json': async () => new Response(shard('transcript', 'Иной фрагмент.')) });
		const result = await searchScoped('квазигармоническая адаптация', [scope]);
		expect(result.matchKind).toBe('semantic');
		expect(result.hits[0]?.snippet).toBe('Подлинный текст главы.');
		expect(result.hits[0]?.href).toBe('/reports/fixture/#ch-1');
		expect(await searchReportExact('fixture', 'квазигармоническая адаптация')).toEqual([]);
		expect(await searchReportsExact('квазигармоническая адаптация', 40, ['fixture'])).toEqual([]);
		expect((await searchScoped('квазигармоническая адаптация', [{ ...scope, reportSlug: 'other' }])).hits).toEqual([]);
		expect((await searchScoped('квазигармоническая адаптация', [{ ...scope, zones: ['transcript'] }])).hits).toEqual([]);
	});
	it('serves the core without waiting for transcripts, then finds transcript-only content', async () => {
		let finish!: (response: Response) => void;
		const pending = new Promise<Response>(resolve => { finish = resolve; });
		serve({ 'index-transcripts.json': () => pending });
		const first = await searchScoped('подъёмы', [scope]);
		expect(first.pending).toBe(true);
		expect(first.hits[0]?.kind).toBe('chapter');
		finish(new Response(transcript));
		await whenSearchComplete();
		const second = await searchScoped('квазигармонический', [{ ...scope, zones: ['transcript'] }]);
		expect(second.pending).toBe(false);
		expect(second.hits[0]?.kind).toBe('transcript');
	});

	it.each([503, 404])('keeps core results when transcript HTTP %s fails', async status => {
		const fetch = serve({ 'index-transcripts.json': async () => new Response('', { status }) });
		await searchScoped('подъёмы', [scope]);
		await whenSearchComplete();
		const result = await searchScoped('подъёмы', [scope]);
		expect(result.pending).toBe(false);
		expect(result.hits[0]?.kind).toBe('chapter');
		await whenSearchComplete();
		expect(fetch.mock.calls.filter(([url]) => String(url).includes('index-transcripts')).length).toBe(1);
	});

	it('retries a failed core load on the next query', async () => {
		let calls = 0;
		serve({ 'index-core.json': async () => ++calls === 1 ? new Response('', { status: 503 }) : new Response(core) });
		await expect(searchScoped('подъёмы', [scope])).rejects.toThrow('503');
		expect((await searchScoped('подъёмы', [scope])).hits.length).toBeGreaterThan(0);
		await whenSearchComplete();
		expect(calls).toBe(2);
	});

	it('does not require the optional chapter title map', async () => {
		serve({ 'chapter-titles.json': async () => { throw new Error('offline'); } });
		expect((await searchScoped('подъёмы', [scope])).hits.length).toBeGreaterThan(0);
		await whenSearchComplete();
	});

	it('preserves ranking under casing, yo/ye and whitespace transformations', async () => {
		serve();
		await whenSearchComplete();
		const reference = await searchScoped('подъёмы на носки', [scope]);
		for (const query of ['ПОДЪЕМЫ НА НОСКИ', '  подъёмы   на носки  ']) {
			const result = await searchScoped(query, [scope]);
			expect(result.hits.map(h => [h.kind, h.chapterIndex])).toEqual(reference.hits.map(h => [h.kind, h.chapterIndex]));
		}
	});

	it('never expands a hard empty scope or returns documents from another report', async () => {
		serve();
		await whenSearchComplete();
		for (const target of [
			{ kind: 'archive', label: 'empty', reportSlugs: [] },
			{ kind: 'report', label: 'other', reportSlug: 'other' }
		] as SearchScope[]) {
			expect((await searchScoped('подъёмы', [target])).hits).toEqual([]);
		}
	});
});

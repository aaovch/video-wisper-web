import MiniSearch from 'minisearch';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSearchIndex, searchScoped } from '$lib/search-core';
import { stemRu } from '$lib/stem-ru';
import type { SearchScope } from '$lib/search-types';

const documents = [
	{
		id: 'report-a:chapter:1', kind: 'chapter', zone: 'chapters', reportSlug: 'report-a',
		reportTitle: 'Текущий отчёт', chapterIndex: 0, title: 'Предел планирования',
		text: 'Тренер понимает предел планирования занятия.', href: '/reports/report-a/#ch-1',
		field_title: 'Предел планирования', field_body: 'Тренер понимает предел планирования занятия.', field_tags: ''
	},
	{
		id: 'report-b:chapter:1', kind: 'chapter', zone: 'chapters', reportSlug: 'report-b',
		reportTitle: 'Соседний отчёт', chapterIndex: 0, title: 'Маневрово-атакующий стиль',
		text: 'Маневрово-атакующий боец меняет дистанцию.', href: '/reports/report-b/#ch-1',
		field_title: 'Маневрово атакующий стиль', field_body: 'Маневрово атакующий боец меняет дистанцию.', field_tags: ''
	},
	{
		id: 'report-c:chapter:1', kind: 'chapter', zone: 'chapters', reportSlug: 'report-c',
		reportTitle: 'Архивный отчёт', chapterIndex: 0, title: 'Три позиции и предукол',
		text: 'С большей дистанции заходим в предуколом без сигнала плечами.', href: '/reports/report-c/#ch-1',
		field_title: 'Три позиции и предукол', field_body: 'С большей дистанции заходим в предуколом без сигнала плечами.', field_tags: ''
	},
	{
		id: 'report-d:chapter:1', kind: 'chapter', zone: 'chapters', reportSlug: 'report-d',
		reportTitle: 'Смысловой отчёт', chapterIndex: 0, title: 'Подготовка действия',
		text: 'Атака строится через вызов реакции и выбор защиты.', href: '/reports/report-d/#ch-1',
		field_title: 'Подготовка действия', field_body: 'Атака строится через вызов реакции и выбор защиты.', field_tags: ''
	}
];

let serializedIndex = '';

beforeAll(() => {
	const index = new MiniSearch({
		idField: 'id',
		fields: ['field_title', 'field_body', 'field_tags'],
		storeFields: ['kind', 'zone', 'reportSlug', 'reportTitle', 'chapterIndex', 'title', 'text', 'href'],
		processTerm: (term) => {
			const token = term.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
			return token.length >= 2 ? stemRu(token) : null;
		}
	});
	index.addAll(documents);
	serializedIndex = JSON.stringify(index);
});

beforeEach(() => {
	resetSearchIndex();
	vi.stubGlobal('fetch', vi.fn(async () => new Response(serializedIndex, { status: 200 })));
});

const reportScope: SearchScope = { kind: 'report', label: 'в отчёте', reportSlug: 'report-a' };
const collectionScope: SearchScope = {
	kind: 'collection', label: 'в коллекции', reportSlugs: ['report-a', 'report-b']
};
const archiveScope: SearchScope = {
	kind: 'archive', label: 'во всём архиве', reportSlugs: ['report-a', 'report-b', 'report-c', 'report-d']
};

describe('tiered search', () => {
	it.each(['предукол', 'предуколом', 'ПРЕДУКОЛ'])('finds lexical word form %s', async (query) => {
		const response = await searchScoped(query, [archiveScope]);
		expect(response.matchKind).toBe('exact');
		expect(response.hits[0]?.reportSlug).toBe('report-c');
	});

	it('treats an unfinished word as a prefix before fuzzy correction', async () => {
		const response = await searchScoped('предук', [archiveScope]);
		expect(response.matchKind).toBe('prefix');
		expect(response.hits[0]?.title).toContain('предукол');
	});

	it('marks a typo as a correction', async () => {
		const response = await searchScoped('пределл', [archiveScope]);
		expect(response.matchKind).toBe('correction');
		expect(response.hits[0]?.title).toContain('Предел');
	});

	it('uses the semantic tier for a natural-language query', async () => {
		const response = await searchScoped('как подготовить атаку против позиционной защиты', [archiveScope]);
		expect(response.matchKind).toBe('semantic');
		expect(response.hits.some((hit) => hit.reportSlug === 'report-d')).toBe(true);
	});

	it.each(['квантовый банан', 'как это', '!!!'])('returns empty for %s', async (query) => {
		const response = await searchScoped(query, [archiveScope]);
		expect(response.matchKind).toBe('empty');
		expect(response.hits).toHaveLength(0);
	});
});

describe('scope fallback', () => {
	it('prefers an archive prefix over local fuzzy noise', async () => {
		const response = await searchScoped('предук', [collectionScope, archiveScope]);
		expect(response.fallback).toBe(true);
		expect(response.resultScope.kind).toBe('archive');
		expect(response.matchKind).toBe('prefix');
		expect(response.hits[0]?.reportSlug).toBe('report-c');
	});

	it('expands from report to its collection first', async () => {
		const response = await searchScoped('маневрово-атакующий', [reportScope, collectionScope, archiveScope]);
		expect(response.fallback).toBe(true);
		expect(response.resultScope.kind).toBe('collection');
		expect(response.hits[0]?.reportSlug).toBe('report-b');
	});

	it('expands from report to archive when the collection has no strong match', async () => {
		const response = await searchScoped('предукол', [reportScope, collectionScope, archiveScope]);
		expect(response.resultScope.kind).toBe('archive');
		expect(response.hits[0]?.reportSlug).toBe('report-c');
	});

	it('keeps weak results in the requested scope', async () => {
		const response = await searchScoped('пределл', [reportScope, collectionScope, archiveScope]);
		expect(response.fallback).toBe(false);
		expect(response.resultScope.kind).toBe('report');
		expect(response.matchKind).toBe('correction');
	});

	it('treats an empty slug list as an empty scope', async () => {
		const emptyScope: SearchScope = { kind: 'archive', label: 'во всём архиве', reportSlugs: [] };
		const response = await searchScoped('предукол', [emptyScope]);
		expect(response.matchKind).toBe('empty');
		expect(response.hits).toHaveLength(0);
	});

	it('treats a selected zone as a hard scope constraint', async () => {
		const transcriptOnly: SearchScope = {
			kind: 'report', label: 'в отчёте', reportSlug: 'report-a', zones: ['transcript']
		};
		const response = await searchScoped('предел', [transcriptOnly]);
		expect(response.matchKind).toBe('empty');
		expect(response.hits).toHaveLength(0);
	});
});

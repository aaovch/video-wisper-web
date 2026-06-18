import type { Report } from '$lib/types';
import { getReport } from './index';

/** Тематическая подборка видео. Видео может входить в несколько коллекций. */
export interface Collection {
	slug: string;
	title: string;
	subtitle: string;
	/** Slug'и отчётов в порядке показа внутри коллекции. */
	items: string[];
}

// Порядок здесь = порядок карточек на главной.
export const collections: Collection[] = [
	{
		slug: 'almaty-2026',
		title: 'Фехтовальный лагерь «Алматы 2026»',
		subtitle: 'Семинары и тренировки лагеря: сабля (общая и «А») и длинный меч.',
		items: [
			'sablya-vvodnaya',
			'sablya-a-2',
			'sablya-a-3',
			'sablya-4',
			'sablya-a-5',
			'sablya-6',
			'sablya-a-7',
			'sablya-8',
			'sablya-a-9',
			'sablya-10',
			'sablya-12',
			'longsword-a'
		]
	},
	{
		slug: 'hema-theory',
		title: 'HEMA: теория и тренерство',
		subtitle: 'Контекст HEMA, методика защит и удержание атлетов в клубе.',
		items: ['hema-reflections', 'metodichka', 'retention']
	},
	{
		slug: 'podcasts',
		title: 'Подкасты: ИИ и индустрия',
		subtitle: 'Разговоры про искусственный интеллект, найм и будущее разработки.',
		items: ['software-3-0', 'berezhnoy-ai']
	}
];

export function getCollection(slug: string): Collection | undefined {
	return collections.find((c) => c.slug === slug);
}

export function getCollectionSlugs(): string[] {
	return collections.map((c) => c.slug);
}

/** Отчёты коллекции в заданном порядке (несуществующие slug'и отбрасываются). */
export function collectionReports(collection: Collection): Report[] {
	return collection.items
		.map((slug) => getReport(slug))
		.filter((r): r is Report => Boolean(r));
}

/** Коллекции, в которые входит отчёт (для крошек на странице отчёта). */
export function collectionsForReport(slug: string): Collection[] {
	return collections.filter((c) => c.items.includes(slug));
}

export interface CollectionStats {
	videos: number;
	chapters: number;
}

export function collectionStats(collection: Collection): CollectionStats {
	const rs = collectionReports(collection);
	return {
		videos: rs.length,
		chapters: rs.reduce((acc, r) => acc + r.chapters.length, 0)
	};
}

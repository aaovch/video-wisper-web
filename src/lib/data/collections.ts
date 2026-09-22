import type { ReportSummary } from '$lib/types';
import { getReportSummary } from './report-meta';
import collectionsData from './collections.json';

/** Разбор коллекции: что заявлялось и как это сработало на практике. */
export interface CollectionAnalysis {
	/** Вводный абзац-подводка к разбору. */
	lede: string;
	/** Пары «что заявляли на презентации» → «как вышло в боях». */
	findings: { claim: string; reality: string }[];
	/** Итог по результатам и статистике. */
	outcome: string;
}

/** Фасеты каталога. Они задаются явно, чтобы фильтры не зависели от шумных тегов отчётов. */
export interface CollectionFacets {
	authors?: string[];
	places?: string[];
	weapons?: string[];
}

/** Один клиентский ключ доступа. Версию увеличивают при смене пароля. */
export interface AccessCredential {
	id: string;
	password: string;
	credentialVersion?: number;
	passwordHint?: string;
	passwordContact?: { label: string; url: string };
}

/** Дополнительный ключ, открывающий один материал или явно заданный набор материалов. */
export interface CollectionAccessPass extends AccessCredential {
	title: string;
	items: string[];
}

export interface CollectionAccess {
	/** Мастер-ключ: открывает всю коллекцию и каждый входящий в неё отчёт. */
	master?: AccessCredential;
	/** Альтернативные ключи к отдельным материалам или пакетам материалов. */
	passes?: CollectionAccessPass[];
}

/** Тематическая подборка видео. Видео может входить в несколько коллекций. */
export interface Collection {
	slug: string;
	title: string;
	language?: 'ru' | 'en';
	/** HEMA-коллекции образуют основной каталог; остальные остаются в архиве вторым слоем. */
	hema?: boolean;
	/** Скрыта из основного каталога и поиска; доступна в архиве. */
	archived?: boolean;
	/** Сохраняет старый URL коллекции, но убирает её из каталога и навигации по отчётам. */
	catalogHidden?: boolean;
	/** Объединяет самостоятельные коллекции в общий навигационный блок без смешивания доступа. */
	catalogGroup?: 'noname';
	/** Автор, место и оружие для фильтров главной страницы. */
	facets?: CollectionFacets;
	/** Короткая строка для карточки на главной и meta description. */
	subtitle: string;
	/** Развёрнутое описание на странице коллекции (опционально). */
	description?: string;
	/** Содержательный разбор коллекции (опционально). */
	analysis?: CollectionAnalysis;
	/** Slug'и отчётов в порядке показа внутри коллекции. */
	items: string[];
	/** Необязательные визуальные разделы для страницы коллекции. */
	sections?: { title: string; subtitle?: string; items: string[] }[];
	/** Не выводить из коллекции и её отчётов навигацию или поиск по общему архиву. */
	isolated?: boolean;
	/**
	 * Иерархия клиентских ключей. Мастер открывает всё, каждый pass — только свои items.
	 * Внимание: это «лёгкий замок» на клиенте, а не настоящая защита: контент всё
	 * равно лежит в JS-бандле. Достаточно, чтобы отсечь случайных людей.
	 */
	access?: CollectionAccess;
	/** Требовать ключ и для прямого URL отчёта при членстве в открытой подборке. */
	protectedReports?: boolean;
}

// Порядок здесь = порядок карточек на главной.
export const collections: Collection[] = collectionsData as Collection[];

export function getCollection(slug: string): Collection | undefined {
	return collections.find((c) => c.slug === slug);
}

export function getCollectionSlugs(): string[] {
	return collections.map((c) => c.slug);
}

/** Отчёты коллекции в заданном порядке (несуществующие slug'и отбрасываются). */
export function collectionReports(collection: Collection): ReportSummary[] {
	return collection.items
		.map((slug) => getReportSummary(slug))
		.filter((r): r is ReportSummary => Boolean(r));
}

/** Коллекции, в которые входит отчёт (для крошек на странице отчёта). */
export function collectionsForReport(slug: string): Collection[] {
	return collections.filter((c) => !c.catalogHidden && c.items.includes(slug));
}

export interface AccessTarget extends AccessCredential {
	kind: 'master' | 'pass';
	collectionSlug: string;
	title: string;
}

export function accessTargetToken(target: AccessTarget): string {
	return `${target.id}@${target.credentialVersion ?? 1}`;
}

/** Принимает versioned runtime tokens и старые id для тестов/миграции версии 1. */
export function isAccessTargetUnlocked(target: AccessTarget, unlocked: readonly string[]): boolean {
	return unlocked.includes(accessTargetToken(target)) ||
		((target.credentialVersion ?? 1) === 1 && unlocked.includes(target.id));
}

export function collectionMasterTarget(collection: Collection): AccessTarget | undefined {
	const master = collection.access?.master;
	if (!master) return undefined;
	return {
		...master,
		kind: 'master',
		collectionSlug: collection.slug,
		title: collection.title
	};
}

export function collectionAccessTargets(collection: Collection): AccessTarget[] {
	const master = collectionMasterTarget(collection);
	const passes = (collection.access?.passes ?? []).map((pass) => ({
		...pass,
		kind: 'pass' as const,
		collectionSlug: collection.slug
	}));
	return [...(master ? [master] : []), ...passes];
}

export function allAccessTargets(source: readonly Collection[] = collections): AccessTarget[] {
	return source.flatMap(collectionAccessTargets);
}

export function collectionGate(collection: Collection): AccessTarget[] {
	return collectionAccessTargets(collection);
}

export function hasFullCollectionAccess(collection: Collection, unlocked: readonly string[]): boolean {
	const master = collectionMasterTarget(collection);
	return !master || isAccessTargetUnlocked(master, unlocked);
}

export function canEnterCollection(collection: Collection, unlocked: readonly string[]): boolean {
	if (!collection.access?.master) return true;
	return collectionAccessTargets(collection).some((target) => isAccessTargetUnlocked(target, unlocked));
}

/**
 * Альтернативные ключи отчёта. Мастер любой закрытой коллекции всегда подходит.
 * Явный pass делает выбранный отчёт закрытым даже внутри открытой коллекции.
 * Без pass открытая коллекция сохраняет публичный URL, кроме случая, когда
 * другая коллекция явно требует доступ и к каждому своему отчёту.
 */
export function reportGate(slug: string, source: readonly Collection[] = collections): AccessTarget[] {
	const containing = source.filter((collection) => collection.items.includes(slug));
	if (containing.length === 0) return [];
	const masters = containing
		.map(collectionMasterTarget)
		.filter((target): target is AccessTarget => Boolean(target));
	const passes = containing.flatMap((collection) =>
		(collection.access?.passes ?? [])
			.filter((pass) => pass.items.includes(slug))
			.map((pass) => ({
				...pass,
				kind: 'pass' as const,
				collectionSlug: collection.slug
			}))
	);
	if (passes.length > 0) return [...masters, ...passes];
	if (
		!containing.some((collection) => collection.protectedReports && collection.access?.master) &&
		containing.some((collection) => !collection.access?.master)
	) return [];
	return masters;
}

export function canAccessReport(
	slug: string,
	unlocked: readonly string[],
	source: readonly Collection[] = collections
): boolean {
	const gate = reportGate(slug, source);
	return gate.length === 0 || gate.some((target) => isAccessTargetUnlocked(target, unlocked));
}

export interface CollectionStats {
	videos: number;
	chapters: number;
	duration: number;
}

export function collectionStats(collection: Collection): CollectionStats {
	const rs = collectionReports(collection);
	return {
		videos: rs.length,
		chapters: rs.reduce((acc, r) => acc + r.chapterCount, 0),
		duration: rs.reduce((acc, r) => acc + r.duration, 0)
	};
}

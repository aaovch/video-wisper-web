<script lang="ts">
	import { Input } from '@ui-sdk/svelte/input';
	import { Button } from '@ui-sdk/svelte/button';
	import PageMetadata from '$lib/components/PageMetadata.svelte';
	import WeaponDrawing from './WeaponDrawing.svelte';
	import { browser } from '$app/environment';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import Lock from '$lib/components/Lock.svelte';
	import ReportCard from '$lib/components/ReportCard.svelte';
	import ScopedArchiveSearch from '$lib/components/ScopedArchiveSearch.svelte';

	import {
		accessibleRecordingCount,
		canEnterCollection,
		collectionGate,
		hasFullCollectionAccess
	} from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';
	import { SITE_NAME, communityArchive } from '$lib/site';
	import type { Collection } from '$lib/data/collections';
	import type { ReportSummary } from '$lib/types';

	let { collection, reports }: { collection: Collection; reports: ReportSummary[] } = $props();
	const illustrated = $derived(collection.slug === 'almaty-2026');
	const language = $derived(collection.language ?? 'ru');
	const intro = $derived(collection.description ?? collection.subtitle);
	const reportIndex = $derived(new Map(reports.map((report, i) => [report.slug, i])));
	const reportBySlug = $derived(new Map(reports.map((report) => [report.slug, report])));
	const gate = $derived(collectionGate(collection));
	const contactTargets = $derived(gate.filter((target, i) => target.passwordContact &&
		gate.findIndex(other => other.passwordContact?.url === target.passwordContact?.url) === i));
	const total = $derived(new Set(collection.items).size);
	const openCount = $derived(accessibleRecordingCount(collection.items, lock.unlocked));
	const fullAccess = $derived(hasFullCollectionAccess(collection, lock.unlocked));
	const locked = $derived(!canEnterCollection(collection, lock.unlocked));
	const partialAccess = $derived(gate.length > 0 && !locked && openCount < total);
	let masterValue = $state('');
	let masterFailed = $state(false);
	let masterBusy = $state(false);
	let collectionFilterState = $state<{ collectionSlug: string; reportSlugs: string[] } | null>(null);
	const visibleReportSlugs = $derived(
		collectionFilterState?.collectionSlug === collection.slug
			? collectionFilterState.reportSlugs
			: collection.items
	);
	const visibleReportSlugSet = $derived(new Set(visibleReportSlugs));
	const visibleSections = $derived(
		collection.sections
			?.map((section) => ({
				...section,
				items: section.items.filter((slug) => visibleReportSlugSet.has(slug))
			}))
			.filter((section) => section.items.length > 0)
	);

	function updateCollectionFilter(reportSlugs: string[]) {
		collectionFilterState = { collectionSlug: collection.slug, reportSlugs };
	}

	async function unlockMaster(event: Event) {
		event.preventDefault();
		if (masterBusy) return;
		masterBusy = true;
		try {
		if (await lock.tryUnlock(gate, masterValue.trim())) {
			masterValue = '';
			masterFailed = false;
		} else {
			masterFailed = true;
		}
		} finally { masterBusy = false; }
	}
</script>

<PageMetadata title={`${collection.title} — ${SITE_NAME}`} description={intro} {language} />

{#if locked}
	<Lock
		targets={gate}
		title={collection.title}
		subtitle={language === 'en' ? 'Internal collection. Enter its access key.' : 'Внутренняя коллекция. Для просмотра нужен её ключ.'}
	/>
{:else}
	<header class="container hero">
		{#if communityArchive || !collection.isolated}
			<nav class="breadcrumbs" aria-label={language === 'en' ? 'Breadcrumbs' : 'Хлебные крошки'}>
				<a href="{base}/{!communityArchive && collection.archived ? 'archive/' : ''}"><ArrowLeft size={16} /> {communityArchive ? (language === 'en' ? 'Home' : 'На главную') : language === 'en' ? (collection.archived ? 'Archive' : 'Catalog') : (collection.archived ? 'Архив' : 'Каталог')}</a>
				{#if !illustrated}<span aria-hidden="true">/</span><span>{collection.title}</span>{/if}
			</nav>
		{/if}
		<div class:illustrated>
			<div class="collection-heading-mark">
				<p class="eyebrow label">{language === 'en' ? 'Collection' : 'Коллекция'}</p>
				{#if illustrated}<WeaponDrawing weapon="feder" />{/if}
			</div>
			<h1>{collection.title}</h1>
			<p class="intro">{intro}</p>
		</div>
		{#if partialAccess}
			<aside class="partial-access" aria-label={language === 'en' ? 'Partial access' : 'Частичный доступ'}>
				<div>
					<p class="label">{openCount > 0 ? (language === 'en' ? `Unlocked ${openCount} of ${total}` : `Открыто ${openCount} из ${total}`) : (language === 'en' ? 'Full materials require a key' : 'Полные материалы по ключу')}</p>
					<p>{language === 'en' ? 'A recording key opens one recording; a collection key opens all its recordings.' : 'Ключ записи открывает одну запись, ключ коллекции — все её записи.'}</p>
				</div>
				<form onsubmit={unlockMaster}>
					<Input type="text" bind:value={masterValue} placeholder={language === 'en' ? 'Access key' : 'Ключ доступа'} required autocomplete="off" autocapitalize="none" spellcheck={false} aria-label={language === 'en' ? 'Recording or collection key' : 'Ключ записи или коллекции'} aria-invalid={masterFailed} onValueChange={() => (masterFailed = false)} data-agent-secret>
						{#snippet render({ props })}
							<input {...props} />
						{/snippet}
					</Input>
					<Button type="submit" disabled={masterBusy}>
						{#snippet render({ props })}
							<button {...props}>{masterBusy ? (language === 'en' ? 'Checking…' : 'Проверяем…') : (language === 'en' ? 'Unlock access' : 'Открыть доступ')}</button>
						{/snippet}
					</Button>
				</form>
				{#each contactTargets as target (target.id)}
					{#if target.passwordContact}<p class="access-contact"><a href={target.passwordContact.url} target="_blank" rel="noopener noreferrer">{target.passwordContact.label}</a></p>{/if}
				{/each}
				{#if masterFailed}<p class="partial-error label" role="alert">{language === 'en' ? 'This key does not unlock materials in this collection.' : 'Этот ключ не открывает материалы этой коллекции.'}</p>{/if}
			</aside>
		{/if}
	</header>

	<div class="container collection-search">
		<ScopedArchiveSearch
			kind="collection"
			reportSlugs={collection.items}
			collectionSlug={collection.slug}
			{language}
			onCollectionFilterChange={updateCollectionFilter}
		/>
	</div>

	{#if collection.analysis && fullAccess}
		<section class="container analysis">
			<div class="section-title">
				<span class="section-num mono">00</span>
				<div><p class="label">{language === 'en' ? 'Practice check' : 'Сверка практикой'}</p><h2>{language === 'en' ? 'What was claimed — and what happened' : 'Что заявляли — и как вышло'}</h2></div>
			</div>
			<p class="lede">{collection.analysis.lede}</p>
			<ol class="findings">
				{#each collection.analysis.findings as finding, i (i)}
					<li class="finding">
						<span class="finding-num mono">{String(i + 1).padStart(2, '0')}</span>
						<div><span class="finding-tag label">{language === 'en' ? 'Claim' : 'Заявляли'}</span><p>{finding.claim}</p></div>
						<div><span class="finding-tag label reality-label">{language === 'en' ? 'In fights' : 'В боях'}</span><p>{finding.reality}</p></div>
					</li>
				{/each}
			</ol>
			<p class="outcome">{collection.analysis.outcome}</p>
		</section>
	{/if}

	<section class="container index">
		{#if browser && page.url.searchParams.get('q')}
			<h2>{language === 'en' ? 'Collection materials' : 'Материалы коллекции'}</h2>
		{/if}
		{#if visibleSections?.length}
			{#each visibleSections as section (section.title)}
				<section class="report-section">
					<header class="section-title">
						<div><h2>{section.title}</h2>{#if section.subtitle}<p class="section-copy">{section.subtitle}</p>{/if}</div>
					</header>
					<ul class="index-list">
						{#each section.items as slug (slug)}
							{@const report = reportBySlug.get(slug)}
							{@const i = reportIndex.get(slug)}
							{#if report && i !== undefined}
								<li><ReportCard {report} index={i + 1} collectionSlug={collection.slug} {language} /></li>
							{/if}
						{/each}
					</ul>
				</section>
			{/each}
		{:else if visibleReportSlugs.length > 0}
			<section class="report-section">
				<ul class="index-list index-list--flat">
					{#each reports.filter((report) => visibleReportSlugSet.has(report.slug)) as report (report.slug)}
						{@const i = reportIndex.get(report.slug) ?? 0}
						<li><ReportCard {report} index={i + 1} collectionSlug={collection.slug} {language} /></li>
					{/each}
				</ul>
			</section>
		{:else}
			<p class="filter-empty" role="status">{language === 'en' ? 'No materials match the selected filters.' : 'По выбранным фильтрам материалов нет.'}</p>
		{/if}
	</section>
{/if}

<style>
	h1, h2 { overflow-wrap: anywhere; }
	.illustrated { display: grid; grid-template-columns: minmax(0, 1fr) clamp(180px, 22vw, 270px); column-gap: 28px; }
	.illustrated .collection-heading-mark { display: contents; }
	.illustrated .collection-heading-mark :global(svg) { grid-column: 2; grid-row: 1 / 4; align-self: center; }
	.illustrated :is(.eyebrow, h1, .intro) { grid-column: 1; }
	@media (max-width: 600px) {
		.illustrated { display: block; }
		.illustrated .collection-heading-mark { display: flex; align-items: center; gap: 16px; margin-bottom: 6px; }
		.illustrated .eyebrow { margin: 0; }
		.illustrated .collection-heading-mark :global(svg) { width: clamp(110px, 32vw, 156px); }
		.illustrated h1 { font-size: clamp(30px, 8vw, 38px); line-height: 1.05; text-wrap: balance; }
		.hero:has(.illustrated) .breadcrumbs { margin-bottom: 10px; }
	}
	.hero { padding-top: clamp(22px, 2.6vw, 34px); padding-bottom: 10px; }
	.breadcrumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; color: var(--ink-faint); font-size: 14px; }
	.breadcrumbs a { display: inline-flex; align-items: center; gap: 6px; color: var(--accent); }
	.eyebrow { margin: 0 0 8px; color: var(--accent); }
	h1 { max-width: none; margin: 0 0 8px; font-size: clamp(38px, 4.2vw, 56px); font-weight: 500; line-height: 0.98; }
	.intro { max-width: 66ch; margin: 0; color: var(--ink-soft); font-size: clamp(17px, 1.7vw, 20px); line-height: 1.45; }
	.partial-access { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px 24px; align-items: end; max-width: 760px; margin-top: 24px; padding: 16px 0; border-top: 1px solid var(--line-strong); border-bottom: 1px solid var(--line); }
	.partial-access p { margin: 0; color: var(--ink-soft); line-height: 1.45; }
	.partial-access .label { margin-bottom: 4px; color: var(--accent); }
	.partial-access form { display: flex; min-width: 0; gap: 8px; }
	.partial-access input { min-width: 0; width: 190px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--paper); padding: 9px 10px; color: var(--ink); font: inherit; }
	.partial-access input[aria-invalid='true'] { border-color: var(--accent); }
	.partial-access button { border: 1px solid var(--accent); border-radius: var(--radius-sm); background: var(--accent); padding: 0 14px; color: var(--paper); font: inherit; cursor: pointer; white-space: nowrap; }
	.partial-access .partial-error { grid-column: 1 / -1; margin: 0; }
	.partial-access .access-contact { grid-column: 1 / -1; }
	.access-contact a { display: inline-flex; align-items: center; min-height: 44px; color: var(--accent-ink); font: 16px/1.4 var(--font-ui); text-decoration: underline; text-underline-offset: 3px; }

	.collection-search { padding-top: 8px; }
	.collection-search :global(.search-field) { min-height: 50px; }
	.collection-search :global(input) { font-size: clamp(16px, 1.4vw, 18px); }

	.analysis, .index { padding-top: 24px; }
	.analysis { padding-bottom: 24px; }
	.section-title { display: grid; grid-template-columns: 46px minmax(0, 1fr); gap: 16px; align-items: start; padding-top: 18px; border-top: 1px solid var(--line-strong); }
	.report-section .section-title { display: block; }
	.section-num { color: var(--accent); font-size: 12px; padding-top: 5px; }
	.section-title .label { margin: 0 0 5px; color: var(--ink-faint); }
	.section-title h2 { margin: 0; font-size: clamp(28px, 3.4vw, 42px); font-weight: 500; line-height: 1.08; }
	.section-copy { max-width: 60ch; margin: 8px 0 0; color: var(--ink-soft); line-height: 1.5; }
	.lede { max-width: 68ch; margin: 20px 0 24px 62px; color: var(--ink-soft); font-size: 17px; line-height: 1.6; }

	.findings { margin: 0 0 0 62px; padding: 0; list-style: none; }
	.finding { display: grid; grid-template-columns: 34px minmax(0, 1fr) minmax(0, 1fr); gap: 20px; padding: 20px 0; border-top: 1px solid var(--line); }
	.finding-num { color: var(--accent); font-size: 11px; }
	.finding-tag { display: block; margin-bottom: 7px; color: var(--ink-faint); }
	.reality-label { color: var(--accent); }
	.finding p { margin: 0; line-height: 1.55; }
	.finding div:last-child p { color: var(--ink-soft); }
	.outcome { max-width: 72ch; margin: 20px 0 0 62px; padding: 18px 0 0 18px; border-top: 1px solid var(--line-strong); border-left: 2px solid var(--accent); font-size: 17px; line-height: 1.6; }

	.index { padding-bottom: 64px; }
	.report-section + .report-section { margin-top: 52px; }
	.index-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px 24px; margin: 20px 0 0 62px; padding: 0; list-style: none; }
	.index-list.index-list--flat { margin-top: 0; margin-left: 0; }
	.filter-empty { margin: 0; padding: 24px 0; border-top: 1px solid var(--line-strong); color: var(--ink-soft); }

	@media (max-width: 960px) {
		.index-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}

	@media (max-width: 760px) {
		.hero { padding-top: 22px; }
		/* справа плавает кнопка темы — не пускаем под неё текст крошек */
		.breadcrumbs { margin-bottom: 24px; padding-right: 52px; }
		h1 { max-width: 17ch; }
		.section-title { grid-template-columns: 34px minmax(0, 1fr); gap: 8px; }
		.lede, .findings, .outcome, .index-list { margin-left: 42px; }
		.finding { grid-template-columns: 28px 1fr; gap: 14px 10px; }
		.finding > div { grid-column: 2; }
		.index-list { grid-template-columns: 1fr; gap: 24px; }
		.partial-access { grid-template-columns: minmax(0, 1fr); align-items: stretch; }
		.partial-access input { width: auto; flex: 1; }
	}

	@media (max-width: 520px) {
		.partial-access form { flex-direction: column; }
		.partial-access input { width: 100%; flex: none; }
		.partial-access button { min-height: 44px; }
		.lede, .findings, .outcome, .index-list { margin-left: 0; }
		.section-title { grid-template-columns: 28px minmax(0, 1fr); }
		.finding { grid-template-columns: 24px 1fr; }
	}
</style>

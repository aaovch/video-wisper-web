<script lang="ts">
	import { base } from '$app/paths';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import Lock from '$lib/components/Lock.svelte';
	import ReportCard from '$lib/components/ReportCard.svelte';
	import ScopedArchiveSearch from '$lib/components/ScopedArchiveSearch.svelte';
	import { reveal, revealDelay } from '$lib/attachments';
	import { lock } from '$lib/lock.svelte';
	import { SITE_NAME } from '$lib/site';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const collection = $derived(data.collection);
	const reports = $derived(data.reports);
	const intro = $derived(collection.description ?? collection.subtitle);
	const reportIndex = $derived(new Map(reports.map((report, i) => [report.slug, i])));
	const reportBySlug = $derived(new Map(reports.map((report) => [report.slug, report])));
	const locked = $derived(Boolean(collection.password) && !lock.isUnlocked(collection.slug));
</script>

<svelte:head>
	<title>{collection.title} — {SITE_NAME}</title>
	<meta name="description" content={intro} />
</svelte:head>

{#if locked}
	<Lock targets={[collection]} title={collection.title} subtitle="Коллекция закрыта. Введите пароль, чтобы открыть доступ." />
{:else}
	<header class="container hero reveal" {@attach reveal()}>
		<nav class="breadcrumbs" aria-label="Хлебные крошки">
			<a href="{base}/"><ArrowLeft size={16} /> Архив</a>
			<span aria-hidden="true">/</span>
			<span>{collection.title}</span>
		</nav>
		<p class="eyebrow label">Коллекция</p>
		<h1>{collection.title}</h1>
		<p class="intro">{intro}</p>
	</header>

	<div class="container collection-search reveal" {@attach reveal()}>
		<ScopedArchiveSearch
			kind="collection"
			reportSlugs={collection.items}
			collectionSlug={collection.slug}
		/>
	</div>

	{#if collection.analysis}
		<section class="container analysis reveal" {@attach reveal()}>
			<div class="section-title">
				<span class="section-num mono">00</span>
				<div><p class="label">Сверка практикой</p><h2>Что заявляли — и как вышло</h2></div>
			</div>
			<p class="lede">{collection.analysis.lede}</p>
			<ol class="findings">
				{#each collection.analysis.findings as finding, i (i)}
					<li class="finding reveal" {@attach reveal({ delay: revealDelay(i, 45) })}>
						<span class="finding-num mono">{String(i + 1).padStart(2, '0')}</span>
						<div><span class="finding-tag label">Заявляли</span><p>{finding.claim}</p></div>
						<div><span class="finding-tag label reality-label">В боях</span><p>{finding.reality}</p></div>
					</li>
				{/each}
			</ol>
			<p class="outcome">{collection.analysis.outcome}</p>
		</section>
	{/if}

	<main class="container index">
		{#if collection.sections}
			{#each collection.sections as section, sectionIndex (section.title)}
				<section class="report-section">
					<header class="section-title">
						<span class="section-num mono">{String(sectionIndex + 1).padStart(2, '0')}</span>
						<div><p class="label">Раздел</p><h2>{section.title}</h2>{#if section.subtitle}<p class="section-copy">{section.subtitle}</p>{/if}</div>
					</header>
					<ul class="index-list">
						{#each section.items as slug (slug)}
							{@const report = reportBySlug.get(slug)}
							{@const i = reportIndex.get(slug)}
							{#if report && i !== undefined}
								<li class="reveal" {@attach reveal({ delay: revealDelay(i, 55) })}><ReportCard {report} index={i + 1} collectionSlug={collection.slug} /></li>
							{/if}
						{/each}
					</ul>
				</section>
			{/each}
		{:else}
			<section class="report-section">
				<ul class="index-list index-list--flat">
					{#each reports as report, i (report.slug)}
						<li class="reveal" {@attach reveal({ delay: revealDelay(i, 55) })}><ReportCard {report} index={i + 1} collectionSlug={collection.slug} /></li>
					{/each}
				</ul>
			</section>
		{/if}
	</main>
{/if}

<style>
	.hero { padding-top: clamp(22px, 2.6vw, 34px); padding-bottom: 10px; }
	.breadcrumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; color: var(--ink-faint); font-size: 14px; }
	.breadcrumbs a { display: inline-flex; align-items: center; gap: 6px; color: var(--accent); }
	.eyebrow { margin: 0 0 8px; color: var(--accent); }
	h1 { max-width: none; margin: 0 0 8px; font-size: clamp(38px, 4.2vw, 56px); font-weight: 500; line-height: 0.98; }
	.intro { max-width: 66ch; margin: 0; color: var(--ink-soft); font-size: clamp(17px, 1.7vw, 20px); line-height: 1.45; }

	.collection-search { padding-top: 8px; }
	.collection-search :global(.search-field) { min-height: 50px; }
	.collection-search :global(input) { font-size: clamp(16px, 1.4vw, 18px); }

	.analysis, .index { padding-top: 24px; }
	.analysis { padding-bottom: 24px; }
	.section-title { display: grid; grid-template-columns: 46px minmax(0, 1fr); gap: 16px; align-items: start; padding-top: 18px; border-top: 1px solid var(--line-strong); }
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

	@media (max-width: 1080px) {
		.index-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}

	@media (max-width: 760px) {
		.hero { padding-top: 22px; }
		.breadcrumbs { margin-bottom: 24px; }
		h1 { max-width: 17ch; }
		.section-title { grid-template-columns: 34px minmax(0, 1fr); gap: 8px; }
		.lede, .findings, .outcome, .index-list { margin-left: 42px; }
		.finding { grid-template-columns: 28px 1fr; gap: 14px 10px; }
		.finding > div { grid-column: 2; }
		.index-list { grid-template-columns: 1fr; gap: 24px; }
	}

	@media (max-width: 480px) {
		.lede, .findings, .outcome, .index-list { margin-left: 0; }
		.section-title { grid-template-columns: 28px minmax(0, 1fr); }
		.finding { grid-template-columns: 24px 1fr; }
	}
</style>

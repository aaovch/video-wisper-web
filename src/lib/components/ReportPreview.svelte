<script lang="ts">
	import { base } from '$app/paths';
	import Lock from './Lock.svelte';
	import { reportOverview } from '$lib/report-overview.js';
	import { formatDuration, russianPlural } from '$lib/utils';
	import { publicReportPreview } from '$lib/data/report-preview.js';
	import { collections } from '$lib/data/collections';
	import type { AccessTarget, Collection } from '$lib/data/collections';
	import type { Report } from '$lib/types';
	let { report, targets, collection, archiveReturn, language = 'ru' }: {
		report: Report; targets: AccessTarget[]; collection?: Collection; archiveReturn?: string; language?: 'ru' | 'en';
	} = $props();
	const synopsis = $derived(reportOverview(report).join(' '));
	const preview = $derived(report.preview ?? publicReportPreview(report, collections).preview);
	const chapterCount = $derived(report.chapterCount ?? report.chapters.length);
</script>

<article class="container preview">
	<nav class="breadcrumbs" aria-label={language === 'en' ? 'Breadcrumbs' : 'Хлебные крошки'}>
		<a href="{base}/">{language === 'en' ? 'Home' : 'На главную'}</a>
		{#if archiveReturn}
			<span aria-hidden="true">/</span><a href={archiveReturn}>{language === 'en' ? 'Back to search results' : 'К результатам поиска'}</a>
		{/if}
		{#if collection}<span aria-hidden="true">/</span><a href="{base}/collections/{collection.slug}/">{collection.title}</a>{/if}
	</nav>
	<header>
		<h1>{report.title}</h1>
		<p class="duration">
			{#if report.duration}<span>{formatDuration(report.duration, language)}</span>{/if}
			{#if chapterCount}<span>{chapterCount} {language === 'en' ? 'chapters' : russianPlural(chapterCount, ['глава', 'главы', 'глав'])}</span>{/if}
			{#if preview?.exerciseCount}<span>{preview.exerciseCount} {language === 'en' ? 'exercises' : russianPlural(preview.exerciseCount, ['упражнение', 'упражнения', 'упражнений'])}</span>{/if}
		</p>
	</header>
	<section class="overview" aria-labelledby="overview-title">
		<h2 id="overview-title">{language === 'en' ? 'About the video' : 'Кратко о видео'}</h2>
		<p>{synopsis || report.subtitle}</p>
	</section>
	{#if preview?.topics.length}
		<section class="inside" aria-labelledby="preview-topics-title">
			<h2 id="preview-topics-title">{language === 'en' ? 'Inside the recording' : 'Что разбирается в записи'}</h2>
			<ol>
				{#each preview.topics as topic, index}
					<li><span class="number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span>{topic}</span></li>
				{/each}
			</ol>
		</section>
	{/if}
	<Lock embedded {targets}
		title={language === 'en' ? 'Full material requires a key' : 'Полный материал по ключу'}
		subtitle={language === 'en' ? 'Unlock the video, detailed notes, study materials and transcript with a key for this recording or its collection.' : 'Видео, подробный конспект, учебные материалы и расшифровка доступны по ключу этой записи или всей коллекции.'}
	/>
</article>

<style>
	h1, h2 { overflow-wrap: anywhere; }
	.preview { max-width: 900px; padding-block: 28px 64px; }
	.breadcrumbs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 32px; padding-right: 48px; color: var(--ink-soft); font: 15px/1.5 var(--font-ui); }
	.breadcrumbs a:hover { text-decoration: underline; }
	h1 { max-width: 25ch; margin: 12px 0; font-size: clamp(32px, 5vw, 50px); line-height: 1.1; }
	.duration { display: flex; flex-wrap: wrap; gap: 6px 20px; color: var(--ink-soft); font: 15px/1.5 var(--font-ui); }
	.inside { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--line); }
	.inside ol { margin: 16px 0; padding: 0; list-style: none; }
	.inside li { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--line); font-size: 20px; line-height: 1.35; }
	.number { color: var(--accent); font: 14px/1.8 var(--font-ui); }
	.overview { margin-top: 32px; }
	h2 { margin-bottom: 12px; font-size: 28px; }
	.overview p { max-width: var(--measure); font-size: 19px; line-height: 1.65; }
</style>

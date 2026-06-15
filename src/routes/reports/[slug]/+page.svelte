<script lang="ts">
	import { base } from '$app/paths';
	import ChapterCard from '$lib/components/ChapterCard.svelte';
	import ChapterNav from '$lib/components/ChapterNav.svelte';
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';
	import { reveal } from '$lib/attachments';
	import { formatDuration } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const report = $derived(data.report);

	let seekTo = $state(0);
	let playerEl = $state<HTMLElement | null>(null);

	function seekVideo(start: number) {
		seekTo = start;
		if (window.matchMedia('(max-width: 1024px)').matches) {
			playerEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function selectChapter(index: number, start: number) {
		seekVideo(start);
		document.getElementById(`ch-${index + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>{report.title} — Video Wisper</title>
	<meta name="description" content={report.subtitle} />
</svelte:head>

<article class="report container">
	<a class="back label" href="{base}/">← Указатель</a>

	<header class="report-head reveal" {@attach reveal()}>
		<div class="tags">
			{#each report.tags as tag (tag)}
				<span class="tag">{tag}</span>
			{/each}
		</div>
		<h1>{report.title}</h1>
		<p class="subtitle">{report.subtitle}</p>
		<p class="meta label">
			{formatDuration(report.duration)} · {report.chapters.length} блоков · {report.source_name}
		</p>
	</header>

	<hr class="rule" />

	<div class="layout" class:no-video={!report.video}>
		<!-- Боковая закреплённая колонка: плеер + навигация -->
		<aside class="rail">
			<div class="rail-sticky">
				{#if report.video}
					<div class="video-wrap" bind:this={playerEl}>
						<VideoPlayer video={report.video} {seekTo} />
						<p class="video-hint label">Кликните блок — видео перемотается</p>
					</div>
				{/if}
				<div class="nav-desktop">
					<ChapterNav chapters={report.chapters} onSelect={selectChapter} />
				</div>
			</div>
		</aside>

		<!-- Основная колонка чтения -->
		<div class="content">
			<section class="overview reveal" {@attach reveal()}>
				<h2 class="label section-label">Главные тезисы</h2>
				<ul class="overview-list">
					{#each report.overview_theses as thesis (thesis)}
						<li>{thesis}</li>
					{/each}
				</ul>
			</section>

			<section class="chapters">
				<h2 class="label section-label">Смысловые блоки</h2>
				{#each report.chapters as chapter, i (chapter.start)}
					<div class="reveal" {@attach reveal()}>
						<ChapterCard
							{chapter}
							index={i}
							onSeek={report.video ? seekVideo : undefined}
						/>
					</div>
				{/each}
			</section>

			{#if report.transcript}
				<section class="transcript reveal" {@attach reveal()}>
					<details>
						<summary><span class="label">Полная расшифровка</span></summary>
						<p>{report.transcript}</p>
					</details>
				</section>
			{/if}
		</div>
	</div>
</article>

<style>
	.report {
		padding-top: 28px;
	}

	.back {
		display: inline-block;
		margin-bottom: 26px;
		color: var(--ink-soft);
		border-bottom: 1px solid transparent;
		padding-bottom: 2px;
		transition: border-color 0.2s ease;
	}

	.back:hover {
		border-color: var(--accent);
	}

	.report-head {
		max-width: 24ch;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 18px;
	}

	.report-head h1 {
		font-size: clamp(36px, 6vw, 68px);
		font-weight: 500;
		margin: 0 0 14px;
		max-width: 18ch;
	}

	.subtitle {
		font-size: 21px;
		color: var(--ink-soft);
		max-width: 52ch;
		margin: 0 0 16px;
	}

	.meta {
		margin: 0 0 24px;
	}

	.layout {
		display: grid;
		grid-template-columns: 380px minmax(0, 1fr);
		gap: 56px;
		margin-top: 36px;
	}

	.layout.no-video {
		grid-template-columns: 300px minmax(0, 1fr);
	}

	.rail-sticky {
		position: sticky;
		top: 24px;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.video-wrap {
		scroll-margin-top: 16px;
	}

	.video-hint {
		margin: 10px 0 0;
		text-align: center;
	}

	.section-label {
		margin: 0 0 22px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--line);
	}

	.overview {
		margin-bottom: 52px;
	}

	.overview-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.overview-list li {
		position: relative;
		padding-left: 30px;
		font-size: 21px;
		line-height: 1.5;
		max-width: var(--measure);
	}

	.overview-list li::before {
		content: '§';
		position: absolute;
		left: 0;
		top: 0.05em;
		font-family: var(--font-display);
		color: var(--accent-2);
		font-size: 22px;
	}

	.chapters {
		margin-top: 8px;
	}

	.transcript {
		margin-top: 48px;
	}

	.transcript details {
		border-top: 1px solid var(--line-strong);
	}

	.transcript summary {
		cursor: pointer;
		padding: 18px 0;
		list-style: none;
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.transcript summary::after {
		content: '+';
		font-family: var(--font-mono);
		color: var(--accent);
		margin-left: auto;
		font-size: 18px;
	}

	.transcript details[open] summary::after {
		content: '−';
	}

	.transcript summary::-webkit-details-marker {
		display: none;
	}

	.transcript p {
		margin: 0 0 28px;
		color: var(--ink-soft);
		font-size: 18px;
		line-height: 1.85;
		max-width: var(--measure);
		columns: 1;
	}

	/* Планшет/мобайл: одна колонка, навигация уезжает вниз плеера */
	@media (max-width: 1024px) {
		.layout,
		.layout.no-video {
			grid-template-columns: 1fr;
			gap: 32px;
		}

		.rail-sticky {
			position: static;
		}

		.video-wrap {
			position: sticky;
			top: 8px;
			z-index: 5;
		}

		.nav-desktop {
			display: none;
		}
	}
</style>

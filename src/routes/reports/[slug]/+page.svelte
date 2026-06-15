<script lang="ts">
	import { base } from '$app/paths';
	import ChapterCard from '$lib/components/ChapterCard.svelte';
	import ChapterNav from '$lib/components/ChapterNav.svelte';
	import ReportSearch from '$lib/components/ReportSearch.svelte';
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';
	import { reveal } from '$lib/attachments';
	import type { SearchHit } from '$lib/search';
	import { formatDuration } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const report = $derived(data.report);

	let seekTo = $state(0);
	let playerEl = $state<HTMLElement | null>(null);

	function seekVideo(start: number) {
		seekTo = start;
		if (window.matchMedia('(max-width: 960px)').matches) {
			playerEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function selectChapter(index: number, start: number) {
		seekVideo(start);
		document.getElementById(`ch-${index + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function onSearchHit(hit: SearchHit) {
		if (hit.chapterIndex != null) {
			selectChapter(hit.chapterIndex, hit.start ?? report.chapters[hit.chapterIndex].start);
			return;
		}
		document.querySelector('.report-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>{report.title} — Video Wisper</title>
	<meta name="description" content={report.subtitle} />
</svelte:head>

<article class="report container">
	<div class="layout" class:no-video={!report.video}>
		<!-- Слева: плеер + содержание (sticky с самого верха) -->
		<aside class="rail">
			{#if report.video}
				<div class="video-pin" bind:this={playerEl}>
					<VideoPlayer video={report.video} {seekTo} />
					<p class="video-hint label">Клик по блоку — перемотка</p>
				</div>
			{/if}
			<div class="nav-scroll">
				<ReportSearch {report} onHit={onSearchHit} />
				<ChapterNav chapters={report.chapters} onSelect={selectChapter} />
			</div>
		</aside>

		<!-- Справа: заголовок и текст -->
		<div class="content">
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
					{formatDuration(report.duration)} · {report.chapters.length} блоков
				</p>
			</header>

			<hr class="rule head-rule" />

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

			<p class="source label">{report.source_name}</p>
		</div>
	</div>
</article>

<style>
	.report {
		padding-top: 20px;
		padding-bottom: 48px;
		max-width: 1320px;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(300px, 36%) minmax(0, 1fr);
		gap: clamp(32px, 4vw, 56px);
		align-items: start;
	}

	.layout.no-video {
		grid-template-columns: minmax(240px, 28%) minmax(0, 1fr);
	}

	.rail {
		position: sticky;
		top: 12px;
		align-self: start;
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-height: calc(100vh - 24px);
		min-height: 0;
	}

	.video-pin {
		flex-shrink: 0;
		scroll-margin-top: 12px;
	}

	.nav-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.video-hint {
		margin: 8px 0 0;
		text-align: center;
		font-size: 10px;
	}

	.back {
		display: inline-block;
		margin-bottom: 18px;
		color: var(--ink-soft);
		border-bottom: 1px solid transparent;
		padding-bottom: 2px;
		transition: border-color 0.2s ease;
	}

	.back:hover {
		border-color: var(--accent);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 14px;
	}

	.report-head h1 {
		font-size: clamp(28px, 3.2vw, 44px);
		font-weight: 500;
		margin: 0 0 10px;
		max-width: 22ch;
		line-height: 1.08;
	}

	.subtitle {
		font-size: clamp(17px, 1.6vw, 20px);
		color: var(--ink-soft);
		max-width: 52ch;
		margin: 0 0 10px;
		line-height: 1.45;
	}

	.meta {
		margin: 0;
	}

	.head-rule {
		margin: 22px 0 28px;
	}

	.section-label {
		margin: 0 0 18px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--line);
	}

	.overview {
		margin-bottom: 40px;
	}

	.overview-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.overview-list li {
		position: relative;
		padding-left: 28px;
		font-size: 19px;
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
		font-size: 20px;
	}

	.chapters {
		margin-top: 4px;
	}

	.transcript {
		margin-top: 40px;
	}

	.transcript details {
		border-top: 1px solid var(--line-strong);
	}

	.transcript summary {
		cursor: pointer;
		padding: 16px 0;
		list-style: none;
		display: flex;
		align-items: center;
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
		margin: 0 0 24px;
		color: var(--ink-soft);
		font-size: 17px;
		line-height: 1.85;
		max-width: var(--measure);
	}

	.source {
		margin: 32px 0 0;
		color: var(--ink-faint);
		word-break: break-all;
	}

	@media (max-width: 960px) {
		.layout,
		.layout.no-video {
			grid-template-columns: 1fr;
			gap: 24px;
		}

		.rail {
			position: static;
			max-height: none;
		}

		.nav-scroll {
			overflow: visible;
			max-height: none;
		}

		.video-pin {
			position: sticky;
			top: 8px;
			z-index: 5;
		}

		.report-head h1 {
			max-width: none;
		}
	}
</style>

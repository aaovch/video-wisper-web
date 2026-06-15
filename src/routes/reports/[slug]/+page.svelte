<script lang="ts">
	import { base } from '$app/paths';
	import ChapterCard from '$lib/components/ChapterCard.svelte';
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';
	import { formatDuration } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const report = $derived(data.report);

	let seekTo = $state(0);
	let playerEl = $state<HTMLElement | null>(null);

	function handleSeek(start: number) {
		seekTo = start;
		playerEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>{report.title} — Video Wisper</title>
	<meta name="description" content={report.subtitle} />
</svelte:head>

<article class="report container">
	<a class="back" href="{base}/">← Все отчёты</a>

	<header class="report-head">
		<div class="tags">
			{#each report.tags as tag (tag)}
				<span class="tag">{tag}</span>
			{/each}
		</div>
		<h1>{report.title}</h1>
		<p class="subtitle">{report.subtitle}</p>
		<p class="meta mono">
			{formatDuration(report.duration)} · {report.chapters.length} блоков · {report.source_name}
		</p>
	</header>

	{#if report.video}
		<section class="video" bind:this={playerEl}>
			<VideoPlayer video={report.video} {seekTo} />
			<p class="video-hint">Нажимайте на тайм-коды блоков ниже, чтобы перемотать видео.</p>
		</section>
	{/if}

	<section class="overview">
		<h2>Главные тезисы</h2>
		<ul>
			{#each report.overview_theses as thesis (thesis)}
				<li>{thesis}</li>
			{/each}
		</ul>
	</section>

	<section class="toc">
		<h2>Содержание</h2>
		<ol>
			{#each report.chapters as chapter, i (chapter.start)}
				<li>
					<a href="#ch-{i + 1}">{chapter.title}</a>
				</li>
			{/each}
		</ol>
	</section>

	<section class="chapters">
		<h2>Смысловые блоки</h2>
		{#each report.chapters as chapter, i (chapter.start)}
			<ChapterCard {chapter} index={i} onSeek={report.video ? handleSeek : undefined} />
		{/each}
	</section>

	{#if report.transcript}
		<section class="transcript">
			<details>
				<summary>Полная расшифровка</summary>
				<p>{report.transcript}</p>
			</details>
		</section>
	{/if}
</article>

<style>
	.report {
		padding-top: 32px;
	}

	.back {
		display: inline-block;
		margin-bottom: 24px;
		font-size: 15px;
		color: var(--text-muted);
	}

	.back:hover {
		color: var(--text);
		text-decoration: none;
	}

	.report-head {
		padding-bottom: 28px;
		border-bottom: 1px solid var(--border);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 16px;
	}

	.report-head h1 {
		margin: 0 0 12px;
		font-size: clamp(28px, 5vw, 40px);
	}

	.subtitle {
		margin: 0 0 14px;
		font-size: 18px;
		color: var(--text-muted);
		max-width: 60ch;
	}

	.meta {
		margin: 0;
		font-size: 13px;
		color: var(--text-dim);
	}

	section {
		margin-top: 40px;
	}

	.video {
		scroll-margin-top: 72px;
	}

	.video-hint {
		margin: 12px 0 0;
		font-size: 14px;
		color: var(--text-dim);
	}

	section h2 {
		font-size: 15px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--accent);
		margin: 0 0 18px;
	}

	.overview ul {
		margin: 0;
		padding-left: 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-size: 16.5px;
	}

	.overview li::marker {
		color: var(--accent);
	}

	.toc ol {
		margin: 0;
		padding-left: 22px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 8px 24px;
		color: var(--text-muted);
	}

	.toc a {
		color: var(--text-muted);
	}

	.toc a:hover {
		color: var(--accent);
	}

	.chapters {
		margin-top: 36px;
	}

	.transcript details {
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-elevated);
		padding: 0 20px;
	}

	.transcript summary {
		cursor: pointer;
		padding: 16px 0;
		font-weight: 600;
		color: var(--text);
		list-style-position: inside;
	}

	.transcript summary:hover {
		color: var(--accent);
	}

	.transcript p {
		margin: 0 0 20px;
		color: var(--text-muted);
		font-size: 15.5px;
		line-height: 1.8;
	}
</style>

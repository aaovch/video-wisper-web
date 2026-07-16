<script lang="ts">
	import { base } from '$app/paths';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import Clock from 'phosphor-svelte/lib/Clock';
	import ListBullets from 'phosphor-svelte/lib/ListBullets';
	import Play from 'phosphor-svelte/lib/Play';
	import type { ReportSummary } from '$lib/types';
	import { formatDuration, getVideoPosterUrl } from '$lib/utils';

	let {
		report,
		index,
		collectionSlug
	}: { report: ReportSummary; index: number; collectionSlug: string } = $props();

	const posterUrl = $derived(getVideoPosterUrl(report.video, base));
	const href = $derived(`${base}/reports/${report.slug}/?from=${encodeURIComponent(collectionSlug)}`);
	let posterFailed = $state(false);
</script>

<a class="entry" {href}>
	<div class="thumb">
		{#if posterUrl && !posterFailed}
			<img src={posterUrl} alt="" loading="lazy" decoding="async" onerror={() => (posterFailed = true)} />
		{:else}
			<div class="placeholder" aria-hidden="true"><span>{String(index).padStart(2, '0')}</span></div>
		{/if}
		<span class="play" aria-hidden="true"><Play size={24} weight="fill" /></span>
	</div>

	<div class="body">
		<div class="meta mono">
			<span><Clock size={14} /> {formatDuration(report.duration)}</span>
			<span><ListBullets size={14} /> {report.chapterCount} блоков</span>
		</div>
		<h3>{report.title}</h3>
		<p class="subtitle">{report.subtitle}</p>
		<ul class="leads">
			{#each report.overview_theses.slice(0, 2) as thesis (thesis)}
				<li>{thesis}</li>
			{/each}
		</ul>
		<span class="open">Открыть отчёт <ArrowRight size={18} /></span>
	</div>
</a>

<style>
	.entry {
		display: flex;
		flex-direction: column;
		height: 100%;
		color: var(--ink);
		border-bottom: 1px solid var(--line);
		padding: 0 0 18px;
		transition: border-color 0.2s ease;
	}

	.entry:hover { border-bottom-color: var(--accent); }

	.thumb {
		position: relative;
		aspect-ratio: 16 / 9;
		background: var(--paper-2);
		overflow: hidden;
	}

	.thumb img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
	.entry:hover .thumb img { transform: scale(1.018); }

	.placeholder { width: 100%; height: 100%; display: grid; place-items: center; background: linear-gradient(135deg, var(--paper-2), var(--line)); }
	.placeholder span { font-family: var(--font-display); font-size: clamp(50px, 8vw, 84px); color: var(--line-strong); }

	.play {
		position: absolute;
		left: 12px;
		bottom: 12px;
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		color: var(--paper);
		background: color-mix(in srgb, var(--ink) 78%, transparent);
		border: 1px solid color-mix(in srgb, var(--paper) 45%, transparent);
		border-radius: 50%;
		transition: background 0.2s ease, transform 0.2s ease;
	}

	.entry:hover .play { background: var(--accent); transform: translateY(-2px); }
	.body { display: flex; flex: 1; flex-direction: column; padding-top: 10px; }

	.meta { display: flex; flex-wrap: wrap; gap: 7px 14px; color: var(--ink-faint); font-size: 10px; }
	.meta span { display: inline-flex; align-items: center; gap: 6px; }

	h3 {
		display: -webkit-box;
		margin: 9px 0 6px;
		overflow: hidden;
		font-size: clamp(22px, 1.8vw, 25px);
		font-weight: 500;
		line-height: 1.1;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}
	.entry:hover h3 { color: var(--accent-ink); }

	.subtitle {
		display: -webkit-box;
		margin: 0 0 13px;
		overflow: hidden;
		color: var(--ink-soft);
		font-size: 14.5px;
		line-height: 1.4;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.leads { display: none; }
	.leads li { position: relative; padding-left: 18px; color: var(--ink-soft); font-size: 14.5px; line-height: 1.45; }
	.leads li::before { content: ''; position: absolute; left: 1px; top: 0.68em; width: 8px; height: 1px; background: var(--accent); }

	.open { display: inline-flex; align-items: center; gap: 8px; margin-top: auto; color: var(--accent); font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.07em; text-transform: uppercase; }
	.open :global(svg) { transition: transform 0.2s ease; }
	.entry:hover .open :global(svg) { transform: translateX(4px); }

	@media (max-width: 620px) {
		.entry { padding-bottom: 20px; }
		h3 { font-size: 25px; -webkit-line-clamp: 3; line-clamp: 3; }
		.subtitle { font-size: 16px; -webkit-line-clamp: 3; line-clamp: 3; }
	}
</style>

<script lang="ts">
	import { base } from '$app/paths';
	import { communityArchive } from '$lib/site';
	import LockKeyOpen from 'phosphor-svelte/lib/LockKeyOpen';
	import LockKey from 'phosphor-svelte/lib/LockKey';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import Clock from 'phosphor-svelte/lib/Clock';
	import ListBullets from 'phosphor-svelte/lib/ListBullets';
	import Play from 'phosphor-svelte/lib/Play';
	import type { ReportSummary } from '$lib/types';
	import { reportGate } from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';
	import { formatDuration, getVideoPosterUrl, russianPlural } from '$lib/utils';
	import { reportOverview } from '$lib/report-overview.js';

	let {
		report,
		index,
		collectionSlug,
		cover, byline, language = 'ru'
	}: { report: ReportSummary; index: number; collectionSlug: string; cover?: string; byline?: string; language?: 'ru' | 'en' } = $props();

	const posterUrl = $derived(cover ?? getVideoPosterUrl(report.video, base));
	const gate = $derived(reportGate(report.slug));
	const locked = $derived(gate.length > 0 && !gate.some((target) => lock.isUnlocked(target)));
	const href = $derived(`${base}/reports/${report.slug}/?from=${encodeURIComponent(collectionSlug)}`);
	const synopsis = $derived(reportOverview(report).join(' '));
	let posterFailed = $state(false);
</script>

<a class="entry" {href}>
	<div class="thumb">
		{#if posterUrl && !posterFailed}
			<img src={posterUrl} alt="" loading="lazy" decoding="async" onerror={() => (posterFailed = true)} />
		{:else}
			<div class="placeholder" aria-hidden="true"><span>{String(index).padStart(2, '0')}</span></div>
		{/if}
		<span class="play" aria-hidden="true">{#if communityArchive && locked}<LockKey size={24} />{:else if communityArchive && gate.length}<LockKeyOpen size={24} />{:else}<Play size={24} weight="fill" />{/if}</span>
	</div>

	<div class="body">
		<div class="meta mono">
			<span><Clock size={14} /> {formatDuration(report.duration, language)}</span>
			<span><ListBullets size={14} /> {report.chapterCount} {language === 'en' ? (report.chapterCount === 1 ? 'chapter' : 'chapters') : russianPlural(report.chapterCount, ['блок', 'блока', 'блоков'])}</span>
		</div>
		<h3>{report.title}</h3>
		{#if communityArchive && gate.length && !locked}<span class="sr-access">{language === 'en' ? 'Unlocked' : 'Открыто по ключу'}</span>{/if}
		{#if byline}<p class="byline">{byline}</p>{/if}
		<p class="subtitle">{synopsis || report.subtitle}</p>
		{#if !locked}<ul class="leads">
			{#each report.overview_theses.slice(0, 2) as thesis (thesis)}
				<li>{thesis}</li>
			{/each}
		</ul>{/if}
		<span class="open">{language === 'en' ? (locked ? 'Read synopsis · full material requires a key' : 'Open report') : (locked ? 'Краткий пересказ · полный материал по ключу' : 'Открыть отчёт')} <ArrowRight size={18} /></span>
	</div>
</a>

<style>
	.sr-access { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
	.byline { margin: 0 0 6px; color: var(--ink-faint); font: 14px/1.45 var(--font-ui); }
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

	.meta { display: flex; flex-wrap: wrap; gap: 7px 14px; color: var(--ink-faint); font: 14px/1.45 var(--font-ui); letter-spacing: normal; text-transform: none; }
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

	.open { display: inline-flex; align-items: center; gap: 8px; margin-top: auto; color: var(--accent); font-family: var(--font-mono); font: 14px/1.45 var(--font-ui); }
	.open :global(svg) { transition: transform 0.2s ease; }
	.entry:hover .open :global(svg) { transform: translateX(4px); }

	@media (max-width: 760px) {
		.entry { padding-bottom: 20px; }
		h3 { font-size: 25px; -webkit-line-clamp: 3; line-clamp: 3; }
		.subtitle { font-size: 16px; -webkit-line-clamp: 3; line-clamp: 3; }
	}
</style>

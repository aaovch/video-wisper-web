<script lang="ts">
	import { base } from '$app/paths';
	import VisitCounter from '$lib/components/VisitCounter.svelte';
	import type { ReportSummary } from '$lib/types';
	import { formatDuration, getVideoPosterUrl } from '$lib/utils';

	let { report, index }: { report: ReportSummary; index: number } = $props();

	const hasVideo = $derived(Boolean(report.video));
	const posterUrl = $derived(getVideoPosterUrl(report.video, base));
	let posterFailed = $state(false);
</script>

<a class="entry" href="{base}/reports/{report.slug}/">
	<div class="body">
		<div class="head">
			<span class="numeral" aria-hidden="true">{String(index).padStart(2, '0')}</span>
			{#if !posterUrl || posterFailed}
				<span class="duration mono">
					{#if hasVideo}<span class="rec" aria-hidden="true"></span>{/if}
					{formatDuration(report.duration)}
				</span>
			{/if}
			<VisitCounter target={{ kind: 'report', slug: report.slug }} lazy class="views" />
		</div>

		<h3 class="title">{report.title}</h3>

		{#if posterUrl && !posterFailed}
			<div class="thumb">
				<img
					src={posterUrl}
					alt=""
					loading="lazy"
					decoding="async"
					onerror={() => (posterFailed = true)}
				/>
				<span class="duration mono">
					{#if hasVideo}<span class="rec" aria-hidden="true"></span>{/if}
					{formatDuration(report.duration)}
				</span>
				<span class="play" aria-hidden="true"></span>
			</div>
		{/if}

		<p class="subtitle">{report.subtitle}</p>

		<ul class="leads">
			{#each report.overview_theses.slice(0, 2) as thesis (thesis)}
				<li>{thesis}</li>
			{/each}
		</ul>

		<span class="open">Читать запись <span class="arrow" aria-hidden="true">→</span></span>
	</div>
</a>

<style>
	.entry {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--paper-2);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		color: var(--ink);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
		overflow: hidden;
		transition:
			border-color 0.25s ease,
			transform 0.25s ease;
	}

	.entry:hover {
		border-color: var(--line-strong);
		transform: translateY(-2px);
	}

	.thumb {
		position: relative;
		aspect-ratio: 16 / 9;
		margin: 0 0 14px;
		border-radius: var(--radius-sm);
		background: var(--line);
		overflow: hidden;
	}

	.thumb img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.35s ease;
	}

	.entry:hover .thumb img {
		transform: scale(1.03);
	}

	.thumb .duration {
		position: absolute;
		top: 10px;
		right: 10px;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		background: rgba(28, 24, 20, 0.72);
		color: var(--paper);
		backdrop-filter: blur(4px);
	}

	.thumb .rec {
		background: var(--paper);
		box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.18);
	}

	.play {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.play::after {
		content: '';
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: rgba(28, 24, 20, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.35);
		box-shadow: 0 8px 24px rgba(28, 24, 20, 0.25);
		opacity: 0;
		transform: scale(0.92);
		transition:
			opacity 0.25s ease,
			transform 0.25s ease;
	}

	.play::before {
		content: '';
		position: absolute;
		width: 0;
		height: 0;
		margin-left: 3px;
		border-style: solid;
		border-width: 8px 0 8px 13px;
		border-color: transparent transparent transparent var(--paper);
		opacity: 0;
		transition: opacity 0.25s ease;
	}

	.entry:hover .play::after,
	.entry:hover .play::before {
		opacity: 1;
	}

	.entry:hover .play::after {
		transform: scale(1);
	}

	.body {
		display: flex;
		flex-direction: column;
		flex: 1;
		padding: 22px 24px 20px;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 14px;
		margin-bottom: 8px;
		flex-wrap: wrap;
	}

	.numeral {
		font-family: var(--font-display);
		font-size: 30px;
		font-weight: 400;
		line-height: 1;
		color: var(--line-strong);
		transition: color 0.25s ease;
		font-feature-settings: 'ss01';
	}

	.entry:hover .numeral {
		color: var(--accent);
	}

	.duration {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 12px;
		color: var(--ink-faint);
		white-space: nowrap;
	}

	:global(.views) {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-faint);
		white-space: nowrap;
	}

	.rec {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 3px rgba(138, 43, 34, 0.16);
	}

	.title {
		font-size: clamp(22px, 2.2vw, 27px);
		font-weight: 500;
		margin: 0 0 12px;
		line-height: 1.12;
	}

	.entry:hover .title {
		color: var(--accent-ink);
	}

	.subtitle {
		font-size: 16.5px;
		color: var(--ink-soft);
		margin: 0 0 16px;
		line-height: 1.45;
	}

	.leads {
		margin: 0 0 18px;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 7px;
		flex: 1;
	}

	.leads li {
		position: relative;
		padding-left: 20px;
		color: var(--ink-soft);
		font-size: 15px;
		line-height: 1.4;
	}

	.leads li::before {
		content: '§';
		position: absolute;
		left: 0;
		color: var(--accent-2);
		font-family: var(--font-display);
	}

	.open {
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--accent);
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.arrow {
		transition: transform 0.25s ease;
	}

	.entry:hover .arrow {
		transform: translateX(5px);
	}
</style>

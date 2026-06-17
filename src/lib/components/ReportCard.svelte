<script lang="ts">
	import { base } from '$app/paths';
	import type { Report } from '$lib/types';
	import { formatDuration } from '$lib/utils';

	let { report, index }: { report: Report; index: number } = $props();

	const hasVideo = $derived(Boolean(report.video));
</script>

<a class="entry" href="{base}/reports/{report.slug}/">
	<div class="head">
		<span class="numeral" aria-hidden="true">{String(index).padStart(2, '0')}</span>
		<span class="duration mono">
			{#if hasVideo}<span class="rec" aria-hidden="true"></span>{/if}
			{formatDuration(report.duration)}
		</span>
	</div>

	<h3 class="title">{report.title}</h3>
	<p class="subtitle">{report.subtitle}</p>

	<ul class="leads">
		{#each report.overview_theses.slice(0, 2) as thesis (thesis)}
			<li>{thesis}</li>
		{/each}
	</ul>

	<span class="open">Читать запись <span class="arrow" aria-hidden="true">→</span></span>
</a>

<style>
	.entry {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 22px 24px 20px;
		background: var(--paper-2);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		color: var(--ink);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
		transition:
			border-color 0.25s ease,
			transform 0.25s ease;
	}

	.entry:hover {
		border-color: var(--line-strong);
		transform: translateY(-2px);
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 14px;
		margin-bottom: 8px;
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
		margin: 0 0 8px;
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

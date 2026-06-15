<script lang="ts">
	import { base } from '$app/paths';
	import type { Report } from '$lib/types';
	import { formatDuration } from '$lib/utils';

	let { report, index }: { report: Report; index: number } = $props();

	const hasVideo = $derived(Boolean(report.video));
</script>

<a class="entry" href="{base}/reports/{report.slug}/">
	<div class="numeral" aria-hidden="true">{String(index).padStart(2, '0')}</div>

	<div class="body">
		<div class="meta-row">
			<div class="tags">
				{#each report.tags as tag (tag)}
					<span class="tag">{tag}</span>
				{/each}
			</div>
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

		<div class="foot">
			<span class="label">{report.chapters.length} смысловых блоков</span>
			<span class="open">Читать запись <span class="arrow" aria-hidden="true">→</span></span>
		</div>
	</div>
</a>

<style>
	.entry {
		display: grid;
		grid-template-columns: 132px minmax(0, 1fr);
		gap: 8px 28px;
		padding: 34px 0;
		border-bottom: 1px solid var(--line);
		color: var(--ink);
		transition: background 0.25s ease;
	}

	.entry:hover {
		background: linear-gradient(90deg, transparent, var(--paper-2) 18%, var(--paper-2));
	}

	.numeral {
		font-family: var(--font-display);
		font-size: 64px;
		font-weight: 400;
		line-height: 0.82;
		color: var(--line-strong);
		transition:
			color 0.25s ease,
			transform 0.25s ease;
		font-feature-settings: 'ss01';
	}

	.entry:hover .numeral {
		color: var(--accent);
	}

	.meta-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		margin-bottom: 12px;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.duration {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
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
		font-size: clamp(27px, 3.4vw, 40px);
		font-weight: 500;
		margin: 0 0 8px;
		max-width: 22ch;
	}

	.entry:hover .title {
		color: var(--accent-ink);
	}

	.subtitle {
		font-size: 18px;
		color: var(--ink-soft);
		margin: 0 0 16px;
		max-width: 56ch;
	}

	.leads {
		margin: 0 0 20px;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 60ch;
	}

	.leads li {
		position: relative;
		padding-left: 20px;
		color: var(--ink-soft);
		font-size: 16.5px;
	}

	.leads li::before {
		content: '§';
		position: absolute;
		left: 0;
		color: var(--accent-2);
		font-family: var(--font-display);
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
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

	@media (max-width: 640px) {
		.entry {
			grid-template-columns: 1fr;
			gap: 4px;
			padding: 26px 0;
		}

		.numeral {
			font-size: 40px;
		}
	}
</style>

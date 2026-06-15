<script lang="ts">
	import { base } from '$app/paths';
	import type { Report } from '$lib/types';
	import { formatDuration } from '$lib/utils';

	let { report }: { report: Report } = $props();
</script>

<a class="card" href="{base}/reports/{report.slug}/">
	<div class="card-top">
		<div class="tags">
			{#each report.tags as tag (tag)}
				<span class="tag">{tag}</span>
			{/each}
		</div>
		<span class="duration mono">{formatDuration(report.duration)}</span>
	</div>

	<h2 class="card-title">{report.title}</h2>
	<p class="card-subtitle">{report.subtitle}</p>

	<ul class="card-theses">
		{#each report.overview_theses.slice(0, 3) as thesis (thesis)}
			<li>{thesis}</li>
		{/each}
	</ul>

	<div class="card-foot">
		<span>{report.chapters.length} смысловых блоков</span>
		<span class="arrow" aria-hidden="true">→</span>
	</div>
</a>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 24px;
		border-radius: var(--radius);
		background: var(--bg-card);
		border: 1px solid var(--border);
		color: var(--text);
		transition:
			transform 0.18s ease,
			border-color 0.18s ease,
			background 0.18s ease;
	}

	.card:hover {
		text-decoration: none;
		transform: translateY(-3px);
		background: var(--bg-card-hover);
		border-color: rgba(94, 234, 212, 0.4);
	}

	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.duration {
		font-size: 13px;
		color: var(--text-dim);
		white-space: nowrap;
	}

	.card-title {
		margin: 0;
		font-size: 22px;
	}

	.card-subtitle {
		margin: 0;
		color: var(--text-muted);
		font-size: 15px;
	}

	.card-theses {
		margin: 4px 0 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		color: var(--text-muted);
		font-size: 14.5px;
	}

	.card-theses li::marker {
		color: var(--accent);
	}

	.card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 6px;
		padding-top: 14px;
		border-top: 1px solid var(--border-soft);
		font-size: 14px;
		color: var(--text-dim);
	}

	.arrow {
		font-size: 18px;
		color: var(--accent);
		transition: transform 0.18s ease;
	}

	.card:hover .arrow {
		transform: translateX(4px);
	}
</style>

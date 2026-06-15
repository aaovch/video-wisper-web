<script lang="ts">
	import type { Chapter } from '$lib/types';
	import { formatTime } from '$lib/utils';

	let { chapter, index }: { chapter: Chapter; index: number } = $props();
</script>

<article class="chapter" id="ch-{index + 1}">
	<div class="chapter-aside">
		<span class="num mono">{String(index + 1).padStart(2, '0')}</span>
		<span class="time mono">{formatTime(chapter.start)}</span>
	</div>

	<div class="chapter-body">
		<h3 class="chapter-title">{chapter.title}</h3>
		<p class="chapter-summary">{chapter.summary}</p>

		{#if chapter.theses.length}
			<ul class="theses">
				{#each chapter.theses as thesis (thesis)}
					<li>{thesis}</li>
				{/each}
			</ul>
		{/if}
	</div>
</article>

<style>
	.chapter {
		display: grid;
		grid-template-columns: 72px 1fr;
		gap: 18px;
		padding: 22px 0;
		border-top: 1px solid var(--border-soft);
		scroll-margin-top: 80px;
	}

	.chapter-aside {
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-items: flex-start;
	}

	.num {
		font-size: 13px;
		color: var(--text-dim);
	}

	.time {
		display: inline-flex;
		align-items: center;
		font-size: 13px;
		padding: 2px 8px;
		border-radius: 6px;
		color: var(--accent);
		background: var(--accent-glow);
		border: 1px solid rgba(94, 234, 212, 0.2);
	}

	.chapter-title {
		margin: 0 0 6px;
		font-size: 19px;
	}

	.chapter-summary {
		margin: 0 0 12px;
		color: var(--text-muted);
		font-size: 15.5px;
	}

	.theses {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 15px;
	}

	.theses li::marker {
		color: var(--accent-2);
	}

	@media (max-width: 560px) {
		.chapter {
			grid-template-columns: 1fr;
			gap: 10px;
		}

		.chapter-aside {
			flex-direction: row;
			align-items: center;
			gap: 10px;
		}
	}
</style>

<script lang="ts">
	import type { Chapter } from '$lib/types';
	import { formatTime } from '$lib/utils';

	let {
		chapter,
		index,
		onSeek
	}: { chapter: Chapter; index: number; onSeek?: (start: number) => void } = $props();
</script>

<article class="chapter" id="ch-{index + 1}">
	<header class="head">
		<span class="num">{String(index + 1).padStart(2, '0')}</span>
		{#if onSeek}
			<button type="button" class="tc" onclick={() => onSeek?.(chapter.start)} title="Смотреть с этого момента">
				<span class="tc-play" aria-hidden="true">▶</span>
				<span class="mono">{formatTime(chapter.start)}</span>
			</button>
		{:else}
			<span class="tc tc-static mono">{formatTime(chapter.start)}</span>
		{/if}
	</header>

	<h3 class="title">{chapter.title}</h3>
	<p class="summary">{chapter.summary}</p>

	{#if chapter.theses.length}
		<ul class="theses">
			{#each chapter.theses as thesis (thesis)}
				<li>{thesis}</li>
			{/each}
		</ul>
	{/if}
</article>

<style>
	.chapter {
		padding: 26px 0;
		border-top: 1px solid var(--line);
		scroll-margin-top: 18px;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 10px;
	}

	.num {
		font-family: var(--font-display);
		font-size: 26px;
		font-weight: 500;
		color: var(--accent);
		line-height: 1;
	}

	.tc {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 12px;
		padding: 4px 10px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		color: var(--ink-soft);
		background: transparent;
	}

	button.tc {
		cursor: pointer;
		transition:
			color 0.2s ease,
			background 0.2s ease,
			border-color 0.2s ease;
	}

	button.tc:hover {
		color: var(--paper);
		background: var(--accent);
		border-color: var(--accent);
	}

	.tc-play {
		font-size: 8px;
		color: var(--accent);
		transition: color 0.2s ease;
	}

	button.tc:hover .tc-play {
		color: var(--paper);
	}

	.title {
		font-size: clamp(23px, 2.6vw, 30px);
		font-weight: 500;
		margin: 0 0 8px;
		max-width: 26ch;
	}

	.summary {
		margin: 0 0 16px;
		font-size: 19px;
		color: var(--ink-soft);
		max-width: var(--measure);
	}

	.theses {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 9px;
		max-width: var(--measure);
	}

	.theses li {
		position: relative;
		padding-left: 24px;
		font-size: 17px;
		line-height: 1.5;
	}

	.theses li::before {
		content: '';
		position: absolute;
		left: 2px;
		top: 0.62em;
		width: 9px;
		height: 1px;
		background: var(--accent-2);
	}
</style>

<script lang="ts">
	import type { Chapter } from '$lib/types';
	import { formatTime } from '$lib/utils';

	let {
		chapter,
		index,
		onSeek,
		playing = false
	}: { chapter: Chapter; index: number; onSeek?: (start: number) => void; playing?: boolean } =
		$props();
</script>

<article class="chapter" class:playing id="ch-{index + 1}">
	<header class="head">
		<a class="num" href="#ch-{index + 1}" title="Ссылка на этот блок" aria-label="Ссылка на блок {index + 1}"
			>{String(index + 1).padStart(2, '0')}</a
		>
		{#if onSeek}
			<button type="button" class="tc" onclick={() => onSeek?.(chapter.start)} title="Смотреть с этого момента">
				<span class="tc-play" aria-hidden="true">▶</span>
				<span class="mono">{formatTime(chapter.start)}</span>
			</button>
		{:else}
			<span class="tc tc-static mono">{formatTime(chapter.start)}</span>
		{/if}
		{#if playing}
			<span class="now" aria-label="Сейчас воспроизводится"><span class="now-dot"></span>сейчас</span>
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
		transition: background 0.3s ease;
	}

	/* Блок, на котором сейчас воспроизведение — тонкий штрих слева, без заливки */
	.chapter.playing {
		box-shadow: inset 2px 0 0 var(--accent);
	}

	.head {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 10px;
	}

	.now {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.now-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 50%, transparent);
		animation: now-pulse 1.8s ease-out infinite;
	}

	@keyframes now-pulse {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent);
		}
		70% {
			box-shadow: 0 0 0 6px transparent;
		}
		100% {
			box-shadow: 0 0 0 0 transparent;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.now-dot {
			animation: none;
		}
	}

	.num {
		position: relative;
		font-family: var(--font-display);
		font-size: 26px;
		font-weight: 500;
		color: var(--accent);
		line-height: 1;
		text-decoration: none;
	}

	/* «#» появляется при наведении — подсказка, что номер кликабелен */
	.num::before {
		content: '#';
		position: absolute;
		right: 100%;
		padding-right: 2px;
		color: var(--accent-2);
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.num:hover::before,
	.num:focus-visible::before {
		opacity: 1;
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

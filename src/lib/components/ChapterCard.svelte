<script lang="ts">
	import { Button } from '@ui-sdk/svelte/button';
	import type { Chapter } from '$lib/types';
	import { highlightParts } from '$lib/text-highlight';
	import { formatTime } from '$lib/utils';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import Play from 'phosphor-svelte/lib/Play';

	let {
		chapter,
		index,
		onSeek,
		playing = false,
		live = false,
		highlight = '',
		searchSelected = false,
		transcriptAvailable = false,
		onOpenTranscript,
		language = 'ru'
	}: {
		chapter: Chapter;
		index: number;
		onSeek?: (start: number) => void;
		playing?: boolean;
		live?: boolean;
		highlight?: string;
		searchSelected?: boolean;
		transcriptAvailable?: boolean;
		onOpenTranscript?: (trigger: HTMLButtonElement) => void;
		language?: 'ru' | 'en';
	} = $props();
	const firstMatch = $derived.by(() => {
		if (!searchSelected || !highlight) return null;
		const fields = [chapter.title, chapter.summary, ...chapter.theses];
		for (const [index, text] of fields.entries()) {
			const parts = highlightParts(text, highlight);
			const match = parts.findIndex(part => part.match);
			if (match >= 0) return { index, parts, match };
		}
		return null;
	});
</script>

{#snippet chapterText(text: string, index: number)}
	{#if firstMatch?.index === index}
		{#each firstMatch.parts as part, i}{#if i === firstMatch.match}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}
	{:else}{text}{/if}
{/snippet}

<article class="chapter" class:playing class:search-selected={searchSelected} id="ch-{index + 1}">
	<header class="head">
		<a class="num" href="#ch-{index + 1}" title={language === 'en' ? 'Link to this chapter' : 'Ссылка на эту главу'} aria-label={language === 'en' ? `Link to chapter ${index + 1}` : `Ссылка на главу ${index + 1}`}
			>{String(index + 1).padStart(2, '0')}</a
		>
		{#if onSeek}
			<Button type="button" onclick={() => onSeek?.(chapter.start)} title={language === 'en' ? 'Watch from this point' : 'Смотреть с этого момента'}>
				{#snippet render({ props })}
					<button {...props} class="tc">
				<span class="tc-play" aria-hidden="true"><Play size={10} weight="fill" /></span>
				<span class="mono">{formatTime(chapter.start)}</span>
			</button>
				{/snippet}
			</Button>
		{:else}
			<span class="tc tc-static mono">{formatTime(chapter.start)}</span>
		{/if}
		{#if playing}
			<span class="now" aria-label={language === 'en' ? (live ? 'Playing now' : 'Player paused here') : (live ? 'Сейчас воспроизводится' : 'Плеер остановлен здесь')}>
				{language === 'en' ? (live ? 'now' : 'paused') : (live ? 'сейчас' : 'пауза')}</span>
		{/if}
	</header>

	<h3 class="title">
		{@render chapterText(chapter.title, 0)}
	</h3>
	{#if transcriptAvailable && onOpenTranscript}
		<Button type="button" id="chapter-transcript-trigger-{index + 1}" onclick={(event) => event.currentTarget instanceof HTMLButtonElement && onOpenTranscript?.(event.currentTarget)}>
			{#snippet render({ props })}
				<button {...props} class="read-transcript">
			<span>{language === 'en' ? 'Read transcript' : 'Читать расшифровку'}</span>
			<ArrowRight size={17} weight="bold" aria-hidden="true" />
		</button>
			{/snippet}
		</Button>
	{/if}
	<p class="summary">
		{@render chapterText(chapter.summary, 1)}
	</p>

	{#if chapter.theses.length}
		<ul class="theses">
			{#each chapter.theses as thesis, i (thesis)}
				<li>
					{@render chapterText(thesis, i + 2)}
				</li>
			{/each}
		</ul>
	{/if}

</article>

<style>
	.chapter {
		overflow-wrap: anywhere;
		position: relative;
		padding: 26px 0;
		border-top: 1px solid var(--line);
		scroll-margin-top: calc(var(--search-context-height, 150px) + 20px);
	}


	.head {
		flex-wrap: wrap;
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
		font-size: var(--text-label);
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}


	.num {
		position: relative;
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 500;
		color: var(--ink-soft);
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
		font-size: var(--text-label);
		padding: 4px 10px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		color: var(--ink-soft);
		background: transparent;
	}

	button.tc {
		min-height: var(--hit);
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
		display: grid;
		place-items: center;
		color: inherit;
		transition: color 0.2s ease;
	}

	button.tc:hover .tc-play {
		color: var(--paper);
	}

	.title {
		font-size: clamp(23px, 2.6vw, 30px);
		font-weight: 500;
		margin: 0 0 6px;
		max-width: 26ch;
	}

	.read-transcript {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		min-height: 44px;
		margin: 0 0 8px -2px;
		padding: 8px 2px;
		border: 0;
		background: transparent;
		color: var(--ink-soft);
		font: 14px/1.4 var(--font-ui);
		cursor: pointer;
	}

	.read-transcript :global(svg) { transition: transform 0.18s ease; }
	.read-transcript:hover :global(svg) { transform: translateX(4px); }
	.read-transcript:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; border-radius: 3px; }

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
		background: var(--line-strong);
	}

	mark {
		background: none;
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--accent);
		text-decoration-thickness: 1px;
		text-underline-offset: 0.16em;
	}
</style>

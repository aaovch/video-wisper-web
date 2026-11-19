<script lang="ts">
	import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from '@ui-sdk/svelte/collapsible';
	import { Button } from '@ui-sdk/svelte/button';
	import { onMount } from 'svelte';
	import type { Chapter } from '$lib/types';
	import { formatTime } from '$lib/utils';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';

	let {
		chapters,
		onSelect,
		active = 0,
		language = 'ru'
	}: { chapters: Chapter[]; onSelect: (index: number, start: number) => void; active?: number; language?: 'ru' | 'en' } =
		$props();

	let navEl = $state<HTMLElement | null>(null);
	let open = $state(false);

	onMount(() => {
		if (!window.matchMedia('(max-width: 960px)').matches) open = true;
	});

	function scrollActiveIntoView(index: number) {
		const container = navEl?.closest<HTMLElement>('.nav-scroll');
		const btn = navEl?.querySelector<HTMLElement>(`ol li:nth-child(${index + 1}) button`);
		if (!btn || !container) return;
		if (container.scrollHeight <= container.clientHeight) return;
		const cr = container.getBoundingClientRect();
		const br = btn.getBoundingClientRect();
		if (br.top < cr.top) container.scrollTop += br.top - cr.top - 8;
		else if (br.bottom > cr.bottom) container.scrollTop += br.bottom - cr.bottom + 8;
	}

	function select(index: number, start: number) {
		onSelect(index, start);
		scrollActiveIntoView(index);
	}
</script>

<div class="chapter-nav" bind:this={navEl}><Collapsible bind:open>
	<CollapsibleTrigger>
		{#snippet render({ props })}
			<button {...props} class="disclosure-trigger nav-title label" aria-label={language === 'en' ? 'Contents' : 'Содержание'}>
		{language === 'en' ? 'Contents' : 'Содержание'}
		<span class="count mono">{chapters.length}</span>
		<span class="chevron" aria-hidden="true"><CaretRight size={13} weight="bold" /></span>
	</button>
		{/snippet}
	</CollapsibleTrigger>
	<CollapsiblePanel keepMounted>
	<ol>
		{#each chapters as chapter, i (chapter.start)}
			<li class:active={active === i}>
				<Button type="button" aria-current={active === i ? 'location' : undefined} onclick={() => select(i, chapter.start)}>
					{#snippet render({ props })}
						<button {...props}>
					<span class="idx mono">{String(i + 1).padStart(2, '0')}</span>
					<span class="ttl">{chapter.title}</span>
					<span class="tc mono">{formatTime(chapter.start)}</span>
				</button>
					{/snippet}
				</Button>
			</li>
		{/each}
	</ol>
</CollapsiblePanel>
</Collapsible></div>

<style>
	.disclosure-trigger { text-align: start; font: inherit; color: inherit; background: transparent; border: 0; padding: 0; cursor: pointer; }
	.chapter-nav {
		padding-top: 4px;
	}

	.nav-title {
		min-height: var(--hit);
		font-size: var(--text-label);
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}



	.count {
		font-size: var(--text-label);
		color: var(--ink-faint);
	}

	.chevron {
		margin-left: auto;
		display: grid;
		place-items: center;
		color: var(--ink-faint);
		transition: transform 0.2s ease;
	}

	.nav-title[data-open] .chevron {
		transform: rotate(90deg);
	}

	ol {
		list-style: none;
		margin: 12px 0 0;
		padding: 0;
	}

	li {
		position: relative;
	}

	button {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: baseline;
		gap: 10px;
		width: 100%;
		min-height: var(--hit);
		text-align: left;
		background: none;
		border: 0;
		border-left: 2px solid transparent;
		padding: 7px 10px 7px 12px;
		cursor: pointer;
		color: var(--ink-faint);
		font-family: var(--font-body);
		font-size: var(--text-control);
		line-height: 1.35;
		transition:
			color 0.2s ease,
			border-color 0.2s ease,
			background 0.2s ease;
	}

	button:hover {
		color: var(--ink);
		background: var(--paper-2);
	}

	.idx {
		font-size: var(--text-label);
		color: var(--ink-faint);
	}

	.ttl {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: normal;
	}

	.tc {
		font-size: var(--text-label);
		color: var(--ink-faint);
	}

	.active .ttl { color: var(--ink); font-weight: 600; }
	.active .idx { color: var(--accent-ink); }

	@media (max-width: 960px) {
		.nav-title {
			position: sticky;
			top: var(--mobile-sticky-h, 8px);
			z-index: 4;
			background: var(--paper);
			padding: 10px 0;
			box-shadow: 0 8px 0 var(--paper);
		}
	}
</style>

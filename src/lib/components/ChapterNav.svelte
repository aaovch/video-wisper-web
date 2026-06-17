<script lang="ts">
	import type { Chapter } from '$lib/types';
	import { formatTime } from '$lib/utils';

	let {
		chapters,
		onSelect,
		active = 0
	}: { chapters: Chapter[]; onSelect: (index: number, start: number) => void; active?: number } =
		$props();

	let navEl = $state<HTMLElement | null>(null);
	// Открыто по умолчанию (для SSR/десктопа); на мобильном схлопываем после монтирования.
	let open = $state(true);

	$effect(() => {
		if (window.matchMedia('(max-width: 960px)').matches) open = false;
	});

	// Держим активный пункт в зоне видимости списка (без влияния на скролл страницы).
	$effect(() => {
		active; // переоценивать при смене активного блока
		const btn = navEl?.querySelector<HTMLElement>('li.active button');
		const container = navEl?.closest<HTMLElement>('.nav-scroll');
		if (!btn || !container) return;
		if (container.scrollHeight <= container.clientHeight) return; // список не прокручивается (мобильный)
		const cr = container.getBoundingClientRect();
		const br = btn.getBoundingClientRect();
		if (br.top < cr.top) container.scrollBy({ top: br.top - cr.top - 8, behavior: 'smooth' });
		else if (br.bottom > cr.bottom)
			container.scrollBy({ top: br.bottom - cr.bottom + 8, behavior: 'smooth' });
	});
</script>

<details class="chapter-nav" bind:open bind:this={navEl}>
	<summary class="nav-title label" aria-label="Содержание">
		Содержание
		<span class="count mono">{chapters.length}</span>
		<span class="chevron" aria-hidden="true">▸</span>
	</summary>
	<ol>
		{#each chapters as chapter, i (chapter.start)}
			<li class:active={active === i}>
				<button type="button" onclick={() => onSelect(i, chapter.start)}>
					<span class="idx mono">{String(i + 1).padStart(2, '0')}</span>
					<span class="ttl">{chapter.title}</span>
					<span class="tc mono">{formatTime(chapter.start)}</span>
				</button>
			</li>
		{/each}
	</ol>
</details>

<style>
	.chapter-nav {
		border-top: 1px solid var(--line-strong);
		padding-top: 16px;
	}

	.nav-title {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}

	.nav-title::-webkit-details-marker {
		display: none;
	}

	.count {
		font-size: 11px;
		color: var(--ink-faint);
	}

	.chevron {
		margin-left: auto;
		font-size: 10px;
		color: var(--ink-faint);
		transition: transform 0.2s ease;
	}

	.chapter-nav[open] .chevron {
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
		text-align: left;
		background: none;
		border: 0;
		border-left: 2px solid transparent;
		padding: 7px 10px 7px 12px;
		cursor: pointer;
		color: var(--ink-faint);
		font-family: var(--font-body);
		font-size: 15px;
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
		font-size: 11px;
		color: var(--ink-faint);
	}

	.ttl {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tc {
		font-size: 11px;
		color: var(--ink-faint);
	}

	.active button {
		color: var(--accent-ink);
		border-left-color: var(--accent);
		background: var(--paper-2);
	}

	.active .idx,
	.active .tc {
		color: var(--accent);
	}
</style>

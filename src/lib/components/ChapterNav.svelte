<script lang="ts">
	import type { Chapter } from '$lib/types';
	import { formatTime } from '$lib/utils';

	let {
		chapters,
		onSelect
	}: { chapters: Chapter[]; onSelect: (index: number, start: number) => void } = $props();

	let active = $state(0);

	// Подсветка блока, который сейчас в зоне чтения (скролл-спай).
	$effect(() => {
		const ids = chapters.map((_, i) => `ch-${i + 1}`);
		const nodes = ids
			.map((id) => document.getElementById(id))
			.filter((n): n is HTMLElement => Boolean(n));
		if (!nodes.length || typeof IntersectionObserver === 'undefined') return;

		const visible = new Set<number>();
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const idx = Number((entry.target as HTMLElement).dataset.idx);
					if (entry.isIntersecting) visible.add(idx);
					else visible.delete(idx);
				}
				if (visible.size) active = Math.min(...visible);
			},
			{ rootMargin: '-18% 0px -72% 0px', threshold: 0 }
		);

		nodes.forEach((n, i) => {
			n.dataset.idx = String(i);
			io.observe(n);
		});

		return () => io.disconnect();
	});
</script>

<nav class="chapter-nav" aria-label="Содержание">
	<p class="label nav-title">Содержание</p>
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
</nav>

<style>
	.chapter-nav {
		border-top: 1px solid var(--line-strong);
		padding-top: 16px;
	}

	.nav-title {
		margin: 0 0 10px;
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: min(52vh, 560px);
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		mask-image: linear-gradient(transparent, #000 8px, #000 calc(100% - 10px), transparent);
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
		color: var(--line-strong);
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

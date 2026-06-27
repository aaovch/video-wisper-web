<script lang="ts">
import { onMount } from 'svelte';
import { preloadSearchIndex } from '$lib/search-core';
import type { Component } from 'svelte';

	let SearchBox = $state<Component | null>(null);

	function load() {
		if (SearchBox) return;
		void import('$lib/components/SearchBox.svelte').then((m) => {
			SearchBox = m.default;
		});
		preloadSearchIndex();
	}

	onMount(() => {
		const idle = globalThis.requestIdleCallback as
			| ((cb: () => void, opts?: { timeout: number }) => number)
			| undefined;
		if (idle) idle(() => load(), { timeout: 2500 });
		else setTimeout(load, 500);
	});
</script>

{#if SearchBox}
	<SearchBox />
{:else}
	<!-- Заглушка того же размера, пока грузится чанк поиска -->
	<div class="search-stub" aria-hidden="true">
		<span class="icon">⌕</span>
		<span class="placeholder">Поиск по разборам…</span>
	</div>
{/if}

<style>
	.search-stub {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 0 1 560px;
		max-width: 560px;
		height: 38px;
		margin: 0 auto;
		padding: 0 12px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: var(--paper);
		opacity: 0.55;
	}

	.icon {
		font-size: 16px;
		color: var(--ink-faint);
	}

	.placeholder {
		font-family: var(--font-body);
		font-size: 15px;
		color: var(--ink-faint);
	}

	@media (max-width: 900px) {
		.search-stub {
			max-width: none;
			margin: 12px 0 0;
			order: 3;
			width: 100%;
		}
	}
</style>

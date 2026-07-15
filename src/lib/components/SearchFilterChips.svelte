<script lang="ts">
	import X from 'phosphor-svelte/lib/X';
	import type { ActiveSearchFilter } from '$lib/search-filters';

	let {
		filters,
		onRemove
	}: {
		filters: ActiveSearchFilter[];
		onRemove: (groupId: string, value: string) => void;
	} = $props();
</script>

{#if filters.length > 0}
	<div class="chips" aria-label="Выбранные фильтры">
		{#each filters as filter (`${filter.groupId}:${filter.value}`)}
			<button type="button" onclick={() => onRemove(filter.groupId, filter.value)}>
				<span>{filter.label}</span>
				<X size={14} weight="bold" aria-hidden="true" />
				<span class="sr-only">Убрать фильтр</span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
	.chips { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
	button { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 5px 10px; border: 1px solid var(--accent); border-radius: 999px; background: transparent; color: var(--accent-ink); font: inherit; font-size: 13px; cursor: pointer; }
	button:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
	button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
</style>

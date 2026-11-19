<script lang="ts">
	import { Button } from '@ui-sdk/svelte/button';
	import { tick } from 'svelte';
	import X from 'phosphor-svelte/lib/X';
	import type { ActiveSearchFilter } from '$lib/search-filters';

	let {
		filters,
		onRemove,
		onEmpty,
		language = 'ru'
	}: {
		filters: ActiveSearchFilter[];
		onRemove: (groupId: string, value: string) => void;
		onEmpty?: (groupId: string) => void;
		language?: 'ru' | 'en';
	} = $props();
	let root = $state<HTMLDivElement>();
	async function remove(filter: ActiveSearchFilter, index: number) {
		onRemove(filter.groupId, filter.value);
		await tick();
		const buttons = root?.isConnected ? root.querySelectorAll<HTMLButtonElement>('button') : undefined;
		if (buttons?.length) buttons[Math.min(index, buttons.length - 1)].focus({ preventScroll: true });
		else onEmpty?.(filter.groupId);
	}
</script>

{#if filters.length > 0}
	<div bind:this={root} class="chips" aria-label={language === 'en' ? 'Selected filters' : 'Выбранные фильтры'}>
		{#each filters as filter, index (`${filter.groupId}:${filter.value}`)}
			<Button type="button" aria-label={(language === 'en' ? 'Remove filter ' : 'Убрать фильтр ') + filter.label} onclick={() => remove(filter, index)}>
				{#snippet render({ props })}
					<button {...props}>
				<span>{filter.label}</span>
				<X size={14} weight="bold" aria-hidden="true" />
			</button>
				{/snippet}
			</Button>
		{/each}
	</div>
{/if}

<style>
	.chips { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
	button { display: inline-flex; align-items: center; gap: var(--space-2); max-width: 100%; min-height: var(--hit); padding: 6px 10px; border: 1px solid var(--edge); border-radius: var(--radius); background: var(--surface); color: var(--accent-ink); font: var(--text-label)/1.4 var(--font-ui); text-align: start; overflow-wrap: anywhere; cursor: pointer; }
	button :global(svg) { flex: none; }
	button:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
	button:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
</style>

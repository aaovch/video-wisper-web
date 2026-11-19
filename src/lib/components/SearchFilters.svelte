<script lang="ts">
	import SearchFilterPopover from './SearchFilterPopover.svelte';
	import { Button } from '@ui-sdk/svelte/button';
	import SearchFilterChips from './SearchFilterChips.svelte';
	import { activeSearchFilters, type SearchFilterGroup, type SearchFilterSelections } from '$lib/search-filters';

	interface Props {
		groups: SearchFilterGroup[];
		selections: SearchFilterSelections;
		onToggle: (groupId: string, value: string) => void;
		onClear: () => void;
		language?: 'ru' | 'en';
		inline?: boolean;
	}
	let { groups, selections, onToggle, onClear, language = 'ru', inline = false }: Props = $props();

	let open = $state('');
	let root = $state<HTMLElement>();
	const visible = $derived(groups.filter(group => group.options.length > 1 || selections[group.id]?.length));
	const selected = $derived(activeSearchFilters(groups, selections));

	export function focusGroup(groupId: string) {
		const buttons = root?.querySelectorAll<HTMLButtonElement>('.category');
		const button = Array.from(buttons ?? []).find(button => button.dataset.group === groupId) ?? buttons?.[0];
		button?.focus({ preventScroll: true });
	}
</script>

{#if visible.length || selected.length}
	<section bind:this={root} class="filters" class:inline aria-label={language === 'en' ? 'Filters' : 'Фильтры'}>
		<div class="categories">
			{#each visible as group (group.id)}
				<div class="facet">
					<SearchFilterPopover {group} values={selections[group.id] ?? []} open={open === group.id}
						onOpenChange={(next) => { if (next) open = group.id; else if (open === group.id) open = ''; }} {onToggle} {language} />
				</div>
			{/each}
			{#if !inline && selected.length > 1}<Button type="button" class="clear" onclick={() => { open = ''; onClear(); }}>{language === 'en' ? 'Clear all' : 'Снять все'}</Button>{/if}
		</div>
		{#if !inline}<SearchFilterChips filters={selected} onRemove={(groupId, value) => {
			open = '';
			onToggle(groupId, value);
		}} onEmpty={focusGroup} {language} />{/if}
	</section>
{/if}

<style>
	.filters { font: var(--text-control)/1.4 var(--font-ui); color: var(--ink-soft); min-width: 0; padding-block: var(--space-2); }
	.categories { display: flex; align-items: center; flex-wrap: wrap; gap: 0 var(--space-4); }
	.facet { display: flex; align-items: center; flex-shrink: 0; }
	.categories :global(.clear) { flex: none; min-height: 44px; padding: 0 8px; border: 0; color: inherit; background: transparent; font: inherit; font-size: var(--text-label); cursor: pointer; }
	.inline { padding-block: 0; }
	.inline .categories { gap: 0 12px; }
	@media (max-width: 600px) {
		.inline .categories { display: grid; grid-template-columns: repeat(4, auto); justify-content: space-between; gap: 4px; }
	}
</style>

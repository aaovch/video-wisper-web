<script lang="ts">
	import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui-sdk/svelte/select';
	interface Props {
		value: string;
		label: string;
		id?: string;
		description?: string;
		items: { value: string; label: string }[];
	}
	let { value = $bindable(), label, id, description, items }: Props = $props();
</script>

<Select {items} bind:value={() => value, next => value = next ?? ''}>
	<SelectTrigger {id} aria-label={label} aria-describedby={description} class="stats-select">
		<SelectValue /> <span aria-hidden="true">▾</span>
	</SelectTrigger>
	<SelectContent class="stats-select-list">
		{#each items as item (item.value)}
			<SelectItem value={item.value}>{item.label}</SelectItem>
		{/each}
	</SelectContent>
</Select>

<style>
	:global(.stats-select) { display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 8px 10px; font: inherit; text-align: start; background: var(--paper); color: var(--ink); border: 1px solid var(--edge); border-radius: var(--radius); }
	:global(.stats-select-list) { padding: 4px; min-width: var(--anchor-width); max-height: min(45dvh, var(--available-height)); overflow-y: auto; background: var(--paper); color: var(--ink); border: 1px solid var(--edge); border-radius: var(--radius); }
	:global(.stats-select-list [role=option]) { padding: 8px 12px; cursor: pointer; }
	:global(.stats-select-list [data-highlighted]), :global(.stats-select-list [aria-selected=true]) { background: var(--surface); color: var(--accent-ink); }
</style>

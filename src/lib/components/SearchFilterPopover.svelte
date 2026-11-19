<script lang="ts">
	import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '@ui-sdk/svelte/popover';
	import { Checkbox, CheckboxIndicator } from '@ui-sdk/svelte/checkbox';
	import { Input } from '@ui-sdk/svelte/input';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import WeaponIcon from './WeaponIcon.svelte';
	import type { SearchFilterGroup } from '$lib/search-filters';

	interface Props {
		group: SearchFilterGroup;
		values: string[];
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onToggle: (groupId: string, value: string) => void;
		language: 'ru' | 'en';
	}
	let { group, values, open, onOpenChange, onToggle, language }: Props = $props();
	let term = $state('');
	const selectedLabels = $derived(group.options.filter(option => values.includes(option.value)).map(option => option.label));
</script>

<Popover bind:open={() => open, onOpenChange} onOpenChange={(next) => { if (next) term = ''; }}>
	<PopoverTrigger class="category" data-group={group.id} data-chosen={values.length ? '' : undefined}
		aria-label={values.length ? group.label + ' · ' + selectedLabels.join(', ') : group.label}>
		<span>{group.label}</span>{#if values.length}<span class="count">{values.length}</span>{/if}
		<CaretDown size={11} aria-hidden="true" />
	</PopoverTrigger>
	<PopoverContent class="filter-menu" aria-label={group.label} align="start" sideOffset={4} collisionPadding={16} initialFocus=".find, [data-slot=checkbox]">
		{#if group.options.length > 7}
			<Input class="find" type="search" aria-label={language === 'en' ? 'Find an option' : 'Найти в списке'} placeholder={language === 'en' ? 'Find an option…' : 'Найти в списке…'} bind:value={term} />
		{/if}
		<div class="options">
			{#each group.options.filter(option => option.label.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase())) as option (option.value)}
				<label>
					<Checkbox checked={values.includes(option.value)} onCheckedChange={(checked) => { if (checked !== values.includes(option.value)) onToggle(group.id, option.value); }}>
						<CheckboxIndicator aria-hidden="true">✓</CheckboxIndicator>
					</Checkbox>
					{#if group.id === 'weapons'}<WeaponIcon name={option.label} />{/if}
					<span>{option.label}</span>
				</label>
			{:else}<p>{language === 'en' ? 'No matches' : 'Совпадений нет'}</p>{/each}
		</div>
		<div class="actions"><PopoverClose>{language === 'en' ? 'Done' : 'Готово'}</PopoverClose></div>
	</PopoverContent>
</Popover>

<style>
	:global(.category) { display: inline-flex; align-items: center; gap: 5px; padding: 0; min-height: 44px; border: 0; border-bottom: 1px solid transparent; color: inherit; background: transparent; font: inherit; cursor: pointer; }
	:global(.category) span { max-width: 45vw; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
	.count::before { content: '('; } .count::after { content: ')'; }
	:global(.category[data-open]) { border-color: var(--accent); }
	:global(.category[data-open] svg) { transform: rotate(180deg); }
	:global(.category:hover), :global(.category[data-chosen]) { color: var(--accent-ink); }
	:global(.filter-menu) { width: min(360px, calc(100vw - 32px)); margin: 0; padding: 10px; border: 1px solid var(--line-strong); border-radius: var(--radius); color: var(--ink); background: var(--paper); box-shadow: 0 6px 20px color-mix(in srgb, var(--ink) 12%, transparent); font: var(--text-control)/1.4 var(--font-ui); }
	:global(.filter-menu .find) { box-sizing: border-box; width: 100%; min-height: 44px; padding: 0 10px; border: 1px solid var(--edge); border-radius: var(--radius); color: var(--ink); background: var(--surface); font: inherit; font-size: 16px; }
	.options { max-height: min(32dvh, 265px); overflow-y: auto; overscroll-behavior: contain; }
	label { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 8px 12px; border-radius: var(--radius); cursor: pointer; }
	label:hover, label:focus-within { background: var(--surface); }
	label:has(:global([data-checked])) { color: var(--accent-ink); background: color-mix(in srgb, var(--accent) 8%, var(--paper)); }
	.options :global([data-slot=checkbox]) { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; flex: 0 0 24px; border: 1px solid var(--ink-soft); border-radius: 3px; background: var(--paper); color: var(--ink); cursor: pointer; }
	.options :global([data-slot=checkbox][data-checked]) { background: var(--accent); color: var(--on-action); border-color: var(--accent); }
	:global(.filter-menu :focus-visible) { outline: 3px solid var(--focus); outline-offset: 3px; }
	.actions { display: flex; justify-content: flex-end; padding-top: 6px; border-top: 1px solid var(--edge); }
	.actions :global(button) { min-height: 44px; padding: 0 8px; border: 0; color: var(--ink); background: transparent; font: inherit; cursor: pointer; }
	@media (max-width: 600px) {
		:global(.inline .category) { gap: 2px; font-size: 14px; min-height: var(--hit); }
		:global(.inline .category svg) { display: none; }
		:global(.inline .category) .count { font-size: 12px; align-self: flex-start; margin-top: 5px; }
		:global(.inline) .count::before, :global(.inline) .count::after { content: ''; }
	}
</style>

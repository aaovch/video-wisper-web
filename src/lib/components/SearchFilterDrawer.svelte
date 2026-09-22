<script lang="ts">
	import SearchFilterPanel from '$lib/components/SearchFilterPanel.svelte';
	import { modalFocus } from '$lib/modal-focus';
	import type { SearchFilterGroup, SearchFilterSelections } from '$lib/search-filters';

	let {
		open,
		groups,
		selections,
		onToggle,
		onClear,
		onClose,
		language = 'ru'
	}: {
		open: boolean;
		groups: SearchFilterGroup[];
		selections: SearchFilterSelections;
		onToggle: (groupId: string, value: string) => void;
		onClear: () => void;
		onClose: () => void;
		language?: 'ru' | 'en';
	} = $props();
</script>

{#if open}
	<button class="backdrop" type="button" aria-label={language === 'en' ? 'Close filters' : 'Закрыть фильтры'} onclick={onClose}></button>
	<div use:modalFocus class="sheet" role="dialog" aria-modal="true" aria-label={language === 'en' ? 'Search filters' : 'Фильтры поиска'}>
		<SearchFilterPanel {groups} {selections} {onToggle} {onClear} {onClose} {language} />
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
		width: 100%;
		height: 100%;
		border: 0;
		background: color-mix(in srgb, var(--ink) 28%, transparent);
		cursor: default;
	}

	.sheet {
		position: fixed;
		z-index: 81;
		top: 0;
		right: 0;
		width: min(390px, calc(100vw - 28px));
		height: 100dvh;
		overflow-y: auto;
		padding: 28px;
		border-left: 1px solid var(--line-strong);
		background: var(--paper);
		box-shadow: -18px 0 40px color-mix(in srgb, var(--ink) 12%, transparent);
	}

	@media (max-width: 760px) {
		.sheet {
			top: auto;
			bottom: 0;
			width: 100%;
			height: auto;
			max-height: 84dvh;
			padding: 22px 20px 28px;
			border-top: 1px solid var(--line-strong);
			border-left: 0;
			border-radius: 16px 16px 0 0;
			box-shadow: 0 -18px 40px color-mix(in srgb, var(--ink) 12%, transparent);
		}
	}
</style>

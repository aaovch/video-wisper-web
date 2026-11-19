<script lang="ts">
	import SearchFilters from '../../../src/lib/components/SearchFilters.svelte';
	import ArchiveKeyDialog from '../../../src/lib/components/ArchiveKeyDialog.svelte';
	import { Button } from '@ui-sdk/svelte/button';
	let selections = $state<Record<string, string[]>>({});
	let dialog = $state<ArchiveKeyDialog>();
	const groups = [{ id: 'weapons', label: 'Оружие', options: ['Меч', 'Сабля'].map(value => ({ value, label: value, count: 2 })) }];
</script>

<main>
	<h1>Проверка компонентов архива</h1>
	<SearchFilters {groups} {selections} onClear={() => selections = {}} onToggle={(group, value) => {
		const values = selections[group] ?? [];
		selections = { ...selections, [group]: values.includes(value) ? values.filter(v => v !== value) : [...values, value] };
	}} />
	<Button onclick={() => dialog?.open()}>Ввести ключ</Button>
	<ArchiveKeyDialog bind:this={dialog} />
	<output aria-label="Выбранное оружие">{(selections.weapons ?? []).join(', ')}</output>
</main>

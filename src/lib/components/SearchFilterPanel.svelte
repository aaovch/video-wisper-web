<script lang="ts">
	import X from 'phosphor-svelte/lib/X';
	import type { SearchFilterGroup, SearchFilterSelections } from '$lib/search-filters';

	let {
		groups,
		selections,
		onToggle,
		onClear,
		onClose
	}: {
		groups: SearchFilterGroup[];
		selections: SearchFilterSelections;
		onToggle: (groupId: string, value: string) => void;
		onClear: () => void;
		onClose?: () => void;
	} = $props();

	const visibleGroups = $derived(
		groups.filter(
			(group) =>
				group.options.length > 1 ||
				group.options.some((option) => selections[group.id]?.includes(option.value))
		)
	);
	const activeCount = $derived(
		Object.values(selections).reduce((total, values) => total + values.length, 0)
	);
</script>

<div class="panel">
	<header>
		<div>
			<p class="label">Фильтры</p>
			<h2>Уточнить поиск</h2>
		</div>
		<div class="header-actions">
			{#if activeCount > 0}
				<button type="button" class="clear" onclick={onClear}>Сбросить</button>
			{/if}
			{#if onClose}
				<button type="button" class="close" aria-label="Закрыть фильтры" onclick={onClose}>
					<X size={20} weight="regular" aria-hidden="true" />
				</button>
			{/if}
		</div>
	</header>

	{#each visibleGroups as group (group.id)}
		<fieldset>
			<legend>{group.label}</legend>
			<div class="options">
				{#each group.options as option (option.value)}
					<label>
						<input
							type="checkbox"
							checked={selections[group.id]?.includes(option.value) ?? false}
							onchange={() => onToggle(group.id, option.value)}
						/>
						<span>{option.label}</span>
						<span class="count mono">{option.count}</span>
					</label>
				{/each}
			</div>
		</fieldset>
	{/each}
</div>

<style>
	.panel { min-width: 0; }
	header { display: flex; align-items: flex-start; gap: 16px; padding-bottom: 18px; border-bottom: 1px solid var(--line-strong); }
	header > div:first-child { min-width: 0; }
	.label { margin: 0 0 5px; color: var(--accent); }
	h2 { margin: 0; font-size: clamp(24px, 2.2vw, 31px); font-weight: 500; line-height: 1.08; }
	.header-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
	.clear, .close { border: 0; background: transparent; color: var(--accent); font: inherit; cursor: pointer; }
	.clear { padding: 5px 0; border-bottom: 1px solid var(--line-strong); font-size: 13px; }
	.close { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 1px solid var(--line-strong); border-radius: 999px; }
	fieldset { min-width: 0; margin: 0; padding: 18px 0; border: 0; border-bottom: 1px solid var(--line); }
	legend { width: 100%; padding: 0 0 10px; color: var(--ink-faint); font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
	.options { display: grid; gap: 3px; }
	.options label { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 9px; min-height: 38px; cursor: pointer; color: var(--ink-soft); font-size: 15px; }
	.options label:has(input:checked) { color: var(--accent-ink); }
	input { width: 16px; height: 16px; margin: 0; accent-color: var(--accent); cursor: pointer; }
	.count { color: var(--ink-faint); font-size: 10px; }
	button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
</style>

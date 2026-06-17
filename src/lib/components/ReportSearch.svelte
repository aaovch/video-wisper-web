<script lang="ts">
	import type { Report } from '$lib/types';
	import { searchReport, type SearchHit } from '$lib/search';
	import { formatTime } from '$lib/utils';

	let {
		report,
		onHit
	}: {
		report: Report;
		onHit: (hit: SearchHit) => void;
	} = $props();

	let query = $state('');
	let open = $state(false);
	let activeIndex = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	let rootEl = $state<HTMLElement | null>(null);

	const results = $derived(searchReport(report, query));

	// Сброс выделения при смене запроса/состава результатов.
	$effect(() => {
		results;
		activeIndex = 0;
	});

	function scrollActiveIntoView() {
		rootEl?.querySelector(`#rs-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
	}

	function onInputKey(e: KeyboardEvent) {
		if (!open || results.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = (activeIndex + 1) % results.length;
			scrollActiveIntoView();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = (activeIndex - 1 + results.length) % results.length;
			scrollActiveIntoView();
		} else if (e.key === 'Enter') {
			const hit = results[activeIndex];
			if (hit) {
				e.preventDefault();
				pick(hit);
			}
		}
	}

	const kindLabel: Record<SearchHit['kind'], string> = {
		report: 'запись',
		chapter: 'блок',
		thesis: 'тезис',
		transcript: 'речь'
	};

	function close() {
		open = false;
	}

	function pick(hit: SearchHit) {
		close();
		query = '';
		onHit(hit);
	}

	function onDocClick(e: MouseEvent) {
		if (rootEl && !rootEl.contains(e.target as Node)) close();
	}

	function onWindowKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			close();
			inputEl?.blur();
			return;
		}
		const tag = (document.activeElement as HTMLElement | null)?.tagName;
		if (e.key === 'f' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
			e.preventDefault();
			open = true;
			inputEl?.focus();
		}
	}
</script>

<svelte:window onkeydown={onWindowKey} onclick={onDocClick} />

<div class="search" bind:this={rootEl}>
	<label class="field">
		<span class="icon" aria-hidden="true">⌕</span>
		<input
			bind:this={inputEl}
			type="search"
			name="q-local"
			placeholder="Поиск в этом видео…"
			autocomplete="off"
			spellcheck="false"
			role="combobox"
			aria-expanded={open && results.length > 0}
			aria-controls="rs-panel"
			aria-activedescendant={open && results.length ? `rs-opt-${activeIndex}` : undefined}
			bind:value={query}
			onfocus={() => (open = true)}
			oninput={() => (open = true)}
			onkeydown={onInputKey}
		/>
		<kbd class="hint" aria-hidden="true">f</kbd>
	</label>

	{#if open && query.trim().length >= 2}
		<div class="panel" id="rs-panel" role="listbox" aria-label="Результаты поиска в видео">
			{#if results.length === 0}
				<p class="empty label">Ничего не найдено</p>
			{:else}
				<ul>
					{#each results as hit, i (hit.kind + hit.href + (hit.start ?? '') + hit.snippet)}
						<li role="option" id="rs-opt-{i}" aria-selected={i === activeIndex}>
							<button
								type="button"
								class:is-active={i === activeIndex}
								onmouseenter={() => (activeIndex = i)}
								onclick={() => pick(hit)}
							>
								<span class="row-top">
									<span class="kind label">{kindLabel[hit.kind]}</span>
									{#if hit.start != null}
										<span class="tc mono">{formatTime(hit.start)}</span>
									{/if}
								</span>
								<span class="title">{hit.title}</span>
								<span class="snippet">{hit.snippet}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<style>
	.search {
		position: relative;
		flex-shrink: 0;
	}

	.field {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 36px;
		padding: 0 10px;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--paper);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.field:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(138, 43, 34, 0.1);
	}

	.icon {
		font-size: 15px;
		color: var(--ink-faint);
		line-height: 1;
	}

	input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--ink);
		outline: none;
	}

	input::placeholder {
		color: var(--ink-faint);
	}

	.hint {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 2px 5px;
		border: 1px solid var(--line);
		border-radius: 4px;
		color: var(--ink-faint);
		background: var(--paper-2);
	}

	.panel {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		z-index: 40;
		max-height: min(360px, 45vh);
		overflow: auto;
		background: var(--paper);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 6px;
	}

	li + li {
		margin-top: 2px;
	}

	button {
		display: block;
		width: 100%;
		text-align: left;
		padding: 9px 10px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--ink);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	button:hover,
	button.is-active {
		background: var(--paper-2);
	}

	button.is-active {
		box-shadow: inset 2px 0 0 var(--accent);
	}

	.row-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 3px;
	}

	.tc {
		font-size: 10px;
		color: var(--ink-faint);
	}

	.title {
		display: block;
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 500;
		line-height: 1.25;
		margin-bottom: 2px;
	}

	.snippet {
		display: block;
		font-size: 13px;
		color: var(--ink-soft);
		line-height: 1.35;
	}

	.empty {
		margin: 0;
		padding: 14px;
		text-align: center;
		color: var(--ink-faint);
	}
</style>

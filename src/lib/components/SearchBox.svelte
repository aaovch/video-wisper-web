<script lang="ts">
	import { base } from '$app/paths';
	import { searchReports, type SearchHit } from '$lib/search';

	let query = $state('');
	let open = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);
	let rootEl = $state<HTMLElement | null>(null);

	const results = $derived(searchReports(query));

	const kindLabel: Record<SearchHit['kind'], string> = {
		report: 'запись',
		chapter: 'блок',
		thesis: 'тезис'
	};

	function href(hit: SearchHit) {
		return `${base}${hit.href}`;
	}

	function close() {
		open = false;
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
		if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
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
			name="q"
			placeholder="Поиск по записям и блокам…"
			autocomplete="off"
			spellcheck="false"
			bind:value={query}
			onfocus={() => (open = true)}
			oninput={() => (open = true)}
		/>
		<kbd class="hint" aria-hidden="true">/</kbd>
	</label>

	{#if open && query.trim().length >= 2}
		<div class="panel" role="listbox" aria-label="Результаты поиска">
			{#if results.length === 0}
				<p class="empty label">Ничего не найдено</p>
			{:else}
				<ul>
					{#each results as hit (hit.href + hit.title + hit.snippet)}
						<li role="option">
							<a href={href(hit)} onclick={close}>
								<span class="row-top">
									<span class="kind label">{kindLabel[hit.kind]}</span>
									<span class="from">{hit.reportTitle}</span>
								</span>
								<span class="title">{hit.title}</span>
								<span class="snippet">{hit.snippet}</span>
							</a>
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
		flex: 1;
		max-width: 420px;
		margin: 0 20px;
	}

	.field {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 38px;
		padding: 0 12px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
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
		font-size: 16px;
		color: var(--ink-faint);
		line-height: 1;
	}

	input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		font-family: var(--font-body);
		font-size: 15px;
		color: var(--ink);
		outline: none;
	}

	input::placeholder {
		color: var(--ink-faint);
	}

	.hint {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 2px 6px;
		border: 1px solid var(--line);
		border-radius: 4px;
		color: var(--ink-faint);
		background: var(--paper-2);
	}

	.panel {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		right: 0;
		z-index: 40;
		max-height: min(420px, 60vh);
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

	a {
		display: block;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		color: var(--ink);
		transition: background 0.15s ease;
	}

	a:hover {
		background: var(--paper-2);
		text-decoration: none;
	}

	.row-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 4px;
	}

	.from {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-faint);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.title {
		display: block;
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 500;
		line-height: 1.25;
		margin-bottom: 3px;
	}

	.snippet {
		display: block;
		font-size: 14px;
		color: var(--ink-soft);
		line-height: 1.4;
	}

	.empty {
		margin: 0;
		padding: 16px;
		text-align: center;
		color: var(--ink-faint);
	}

	@media (max-width: 900px) {
		.search {
			max-width: none;
			margin: 12px 0 0;
			order: 3;
			width: 100%;
		}

		.hint {
			display: none;
		}
	}
</style>

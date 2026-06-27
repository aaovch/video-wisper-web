<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { groupByReport, preloadSearchIndex, searchReports, type SearchHit } from '$lib/search';
	import { getCollection } from '$lib/data/collections';
	import { formatTime } from '$lib/utils';

	const hotkey = '/';
	const uid = $props.id();

	let query = $state('');
	let debouncedQuery = $state('');
	let hits = $state<SearchHit[]>([]);
	let open = $state(false);
	let activeIndex = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	let rootEl = $state<HTMLElement | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	const narrowScope = $derived.by(() => {
		const slug = page.params.slug;
		if (page.route.id === '/collections/[slug]' && slug) {
			const col = getCollection(slug);
			if (col) return { label: col.title, slugs: col.items };
		}
		return null;
	});

	let wide = $state(false);
	$effect(() => {
		page.url.pathname;
		wide = false;
	});

	const scoped = $derived(Boolean(narrowScope) && !wide);
	const placeholder = $derived(scoped ? 'Поиск в коллекции…' : 'Поиск по разборам…');

	$effect(() => {
		const q = debouncedQuery.trim();
		const scope = scoped && narrowScope ? narrowScope.slugs : undefined;
		if (q.length < 2) {
			hits = [];
			return;
		}
		let cancelled = false;
		void searchReports(q, 40, scope).then((results) => {
			if (!cancelled) hits = results;
		});
		return () => {
			cancelled = true;
		};
	});

	const view = $derived.by(() => {
		const groups = groupByReport(hits);
		let n = 0;
		return groups.map((g) => ({
			...g,
			rows: g.hits.map((hit) => ({ hit, i: n++ }))
		}));
	});
	const flat = $derived(view.flatMap((g) => g.rows.map((r) => r.hit)));
	const showPanel = $derived(open && debouncedQuery.trim().length >= 2);

	$effect(() => {
		flat;
		activeIndex = 0;
	});

	function scheduleSearch() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedQuery = query;
		}, 180);
	}

	function onQueryInput() {
		open = true;
		scheduleSearch();
	}

	function onFieldFocus() {
		open = true;
		preloadSearchIndex();
	}

	function scrollActiveIntoView() {
		rootEl?.querySelector(`#${uid}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
	}

	function onInputKey(e: KeyboardEvent) {
		if (!open || flat.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = (activeIndex + 1) % flat.length;
			scrollActiveIntoView();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = (activeIndex - 1 + flat.length) % flat.length;
			scrollActiveIntoView();
		} else if (e.key === 'Enter') {
			const hit = flat[activeIndex];
			if (hit) {
				e.preventDefault();
				close();
				query = '';
				goto(href(hit));
			}
		}
	}

	const kindLabel: Record<SearchHit['kind'], string> = {
		report: 'запись',
		chapter: 'блок',
		transcript: 'речь'
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
		if (hotkey && e.key === hotkey && tag !== 'INPUT' && tag !== 'TEXTAREA') {
			e.preventDefault();
			open = true;
			inputEl?.focus();
		}
	}
</script>

<svelte:window onkeydown={onWindowKey} onclick={onDocClick} />

{#if showPanel}
	<div class="scrim" aria-hidden="true"></div>
{/if}

<div class="search" class:open={showPanel} bind:this={rootEl}>
	<label class="field">
		<span class="icon" aria-hidden="true">⌕</span>
		<input
			bind:this={inputEl}
			type="search"
			name="q"
			{placeholder}
			autocomplete="off"
			spellcheck="false"
			role="combobox"
			aria-expanded={open && flat.length > 0}
			aria-controls="{uid}-panel"
			aria-activedescendant={open && flat.length ? `${uid}-opt-${activeIndex}` : undefined}
			bind:value={query}
			onfocus={onFieldFocus}
			oninput={onQueryInput}
			onkeydown={onInputKey}
		/>
		{#if hotkey}
			<kbd class="hint" aria-hidden="true">{hotkey}</kbd>
		{/if}
	</label>

	{#if showPanel}
		<div class="panel" id="{uid}-panel" role="listbox" aria-label="Результаты поиска">
			{#if narrowScope}
				<div class="scope" role="group" aria-label="Область поиска">
					<button type="button" class:active={scoped} onclick={() => (wide = false)}>
						В коллекции
					</button>
					<button type="button" class:active={!scoped} onclick={() => (wide = true)}>
						Везде
					</button>
				</div>
			{/if}
			{#if flat.length === 0}
				<p class="empty label">Ничего не найдено</p>
			{:else}
				{#each view as group (group.reportSlug)}
					<div class="group">
						<a class="group-head" href="{base}{group.href}" onclick={close}>
							<span class="group-title">{group.reportTitle}</span>
							<span class="group-count label">{group.hits.length}</span>
						</a>
						<ul>
							{#each group.rows as { hit, i } (hit.href + hit.title + hit.snippet)}
								<li role="option" id="{uid}-opt-{i}" aria-selected={i === activeIndex}>
									<a
										href={href(hit)}
										class:is-active={i === activeIndex}
										onmouseenter={() => (activeIndex = i)}
										onclick={close}
									>
										<span class="row-top">
											<span class="kind label">{kindLabel[hit.kind]}</span>
											{#if hit.start != null}
												<span class="from">{formatTime(hit.start)}</span>
											{/if}
										</span>
										<span class="title">{hit.title}</span>
										<span class="snippet">{hit.snippet}</span>
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: color-mix(in srgb, var(--ink) 18%, transparent);
		animation: scrim-in 0.18s ease;
	}

	@keyframes scrim-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.scrim {
			animation: none;
		}
	}

	.search {
		position: relative;
		flex: 0 1 560px;
		max-width: 560px;
		margin: 0 auto;
	}

	/* Над скримом, чтобы поле и панель оставались «подсвеченными» */
	.search.open {
		z-index: 50;
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

	.scope {
		display: flex;
		gap: 6px;
		padding: 8px 10px;
		border-bottom: 1px solid var(--line);
	}

	.scope button {
		flex: 1;
		padding: 5px 10px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: var(--paper);
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--ink-soft);
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			border-color 0.15s ease;
	}

	.scope button:hover {
		border-color: var(--accent);
	}

	.scope button.active {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--paper);
	}

	.group + .group {
		border-top: 1px solid var(--line);
	}

	.group-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 8px 14px 4px;
		color: var(--ink-soft);
	}

	.group-head:hover {
		text-decoration: none;
		color: var(--accent);
	}

	.group-title {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.group-count {
		flex-shrink: 0;
		font-size: 10px;
		color: var(--ink-faint);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 2px 6px 6px;
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

	a:hover,
	a.is-active {
		background: var(--paper-2);
		text-decoration: none;
	}

	a.is-active {
		box-shadow: inset 2px 0 0 var(--accent);
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
		font-size: 15px;
		font-weight: 500;
		line-height: 1.25;
		margin-bottom: 3px;
	}

	.snippet {
		display: block;
		font-size: 13px;
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

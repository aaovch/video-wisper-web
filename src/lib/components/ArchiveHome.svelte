<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import FileText from 'phosphor-svelte/lib/FileText';
	import FunnelSimple from 'phosphor-svelte/lib/FunnelSimple';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import Play from 'phosphor-svelte/lib/Play';
	import CollectionCard from '$lib/components/CollectionCard.svelte';
	import SearchFilterChips from '$lib/components/SearchFilterChips.svelte';
	import SearchFilterPanel from '$lib/components/SearchFilterPanel.svelte';
	import { collections, type Collection } from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';
	import {
		preloadSearchIndex,
		searchScoped,
		whenSearchComplete,
		type SearchHit,
		type SearchResultKind,
		type SearchScope
	} from '$lib/search';
	import {
		activeSearchFilters,
		selectedFilterCount,
		type SearchFilterGroup,
		type SearchFilterSelections
	} from '$lib/search-filters';
	import { readRecentReports } from '$lib/recent-reports';
	import { getReportSummary } from '$lib/data/report-meta';
	import { searchableReportSlugs, visibleSubset } from '$lib/search-visibility';
	import { highlightParts } from '$lib/text-highlight';
	import { formatTime } from '$lib/utils';

	let query = $state('');
	let selections = $state<SearchFilterSelections>({ authors: [], places: [], weapons: [], collections: [] });
	let filterSheetOpen = $state(false);
	let hits = $state<SearchHit[]>([]);
	let showAllHits = $state(false);
	let loading = $state(false);
	let searchError = $state(false);
	let resultKind = $state<SearchResultKind>('empty');
	let correctedQuery = $state<string | undefined>();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let requestId = 0;
	let filterReturnFocus: HTMLButtonElement | null = null;
	let inputEl = $state<HTMLInputElement | null>(null);
	let activeHit = $state(-1);

	// «Недавно открывали» живёт только в localStorage — читаем после маунта, чтобы не ломать гидрацию.
	let recentSlugs = $state<string[]>([]);
	onMount(() => {
		recentSlugs = readRecentReports();
	});

	const filterGroups = $derived.by<SearchFilterGroup[]>(() => [
		{
			id: 'authors',
			label: 'Автор',
			options: facetOptions('authors')
		},
		{
			id: 'places',
			label: 'Место',
			options: facetOptions('places')
		},
		{
			id: 'weapons',
			label: 'Оружие',
			options: facetOptions('weapons')
		},
		{
			id: 'collections',
			label: 'Коллекция',
			options: collections.map((collection) => ({
				value: collection.slug,
				label: collection.title,
				count: new Set(collection.items).size
			}))
		}
	]);
	const activeFilters = $derived(activeSearchFilters(filterGroups, selections));
	const activeFilterCount = $derived(selectedFilterCount(selections));
	const hasFilterGroups = $derived(filterGroups.some((group) => group.options.length > 1));

	const filteredCollections = $derived(
		collections.filter(
			(collection) =>
				matchesSelection(selections.authors, collection.facets?.authors) &&
				matchesSelection(selections.places, collection.facets?.places) &&
				matchesSelection(selections.weapons, collection.facets?.weapons) &&
				(selections.collections.length === 0 || selections.collections.includes(collection.slug))
		)
	);
	const primaryCollections = $derived(filteredCollections.filter((collection) => collection.hema));
	const otherCollections = $derived(filteredCollections.filter((collection) => !collection.hema));
	const filtersActive = $derived(activeFilterCount > 0);
	const visibleArchiveSlugs = $derived(searchableReportSlugs(lock.unlocked));
	const recentReports = $derived(
		recentSlugs
			.filter((slug) => visibleArchiveSlugs.includes(slug))
			.map((slug) => getReportSummary(slug))
			.filter((summary): summary is NonNullable<typeof summary> => Boolean(summary))
			.slice(0, 5)
	);
	const scopeSlugs = $derived(
		filtersActive
			? visibleSubset(filteredCollections.flatMap((collection) => collection.items), visibleArchiveSlugs)
			: visibleArchiveSlugs
	);
	const uniqueHits = $derived.by(() => {
		const seen = new Set<string>();
		return hits
			.filter((hit) => {
				const key = uniqueHitKey(hit);
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
	});
	const visibleHits = $derived(showAllHits ? uniqueHits : uniqueHits.slice(0, 3));
	const resultsHeading = $derived.by(() => {
		if (resultKind === 'prefix') return 'Совпадения по началу слова во всём архиве';
		if (resultKind === 'correction') return 'Возможные совпадения во всём архиве';
		if (resultKind === 'semantic') return 'Связанные по смыслу во всём архиве';
		return 'Совпадения по запросу во всём архиве';
	});
	const statusText = $derived(
		loading
			? 'Ищем'
			: searchError
				? 'Поиск временно недоступен'
				: query.trim().length >= 2
					? `${uniqueHits.length} совпадений`
					: ''
	);

	function uniqueFacet(key: 'authors' | 'places' | 'weapons'): string[] {
		return [
			...new Set(
				collections.flatMap((collection) => collection.facets?.[key] ?? []).filter(Boolean)
			)
		].sort((a, b) => a.localeCompare(b, 'ru'));
	}

	function uniqueHitKey(hit: SearchHit): string {
		if (hit.chapterIndex != null) return `${hit.reportSlug}:chapter:${hit.chapterIndex}`;
		if (hit.kind === 'overview') return `${hit.reportSlug}:overview`;
		if (hit.kind === 'report') return `${hit.reportSlug}:report`;
		return `${hit.reportSlug}:${hit.zone}:${hit.title}`;
	}

	function openFilters(event: MouseEvent) {
		filterReturnFocus = event.currentTarget as HTMLButtonElement;
		filterSheetOpen = true;
	}

	function closeFilters() {
		filterSheetOpen = false;
		queueMicrotask(() => filterReturnFocus?.focus());
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (filterSheetOpen && event.key === 'Escape') {
			event.preventDefault();
			closeFilters();
			return;
		}
		// Быстрый фокус в поиск: «/» или Cmd/Ctrl-K, если фокус не в поле ввода.
		const target = event.target as HTMLElement | null;
		const typing = target?.closest('input, textarea, [contenteditable="true"]');
		const shortcut =
			(event.key === '/' && !typing) ||
			((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k');
		if (shortcut) {
			event.preventDefault();
			inputEl?.focus();
			inputEl?.select();
		}
	}

	function onSearchKeydown(event: KeyboardEvent) {
		if (!visibleHits.length) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (activeHit >= visibleHits.length - 1 && !showAllHits && uniqueHits.length > visibleHits.length) {
				showAllHits = true;
			}
			activeHit = Math.min(activeHit + 1, uniqueHits.length - 1);
			focusActiveHit();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeHit = Math.max(activeHit - 1, 0);
			focusActiveHit();
		} else if (event.key === 'Enter' && activeHit >= 0) {
			const hit = visibleHits[activeHit];
			if (hit) {
				event.preventDefault();
				void goto(resultHref(hit, false));
			}
		} else if (event.key === 'Escape' && activeHit >= 0) {
			activeHit = -1;
		}
	}

	function focusActiveHit() {
		queueMicrotask(() =>
			document
				.getElementById(`hit-${activeHit}`)
				?.scrollIntoView({ block: 'nearest' })
		);
	}

	function facetOptions(key: 'authors' | 'places' | 'weapons') {
		return uniqueFacet(key).map((value) => ({
			value,
			label: value,
			count: new Set(
				collections
					.filter((collection) => collection.facets?.[key]?.includes(value))
					.flatMap((collection) => collection.items)
			).size
		}));
	}

	function matchesSelection(selected: string[], values: string[] | undefined): boolean {
		return selected.length === 0 || selected.some((value) => values?.includes(value));
	}

	function collectionCountLabel(count: number): string {
		const mod10 = count % 10;
		const mod100 = count % 100;
		const noun =
			mod10 === 1 && mod100 !== 11
				? 'коллекция'
				: mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
					? 'коллекции'
					: 'коллекций';
		return `${count} ${noun}`;
	}

	function toggleFilter(groupId: string, value: string) {
		const current = selections[groupId] ?? [];
		selections = {
			...selections,
			[groupId]: current.includes(value)
				? current.filter((item) => item !== value)
				: [...current, value]
		};
	}

	function scheduleSearch() {
		clearTimeout(timer);
		const runId = ++requestId;
		showAllHits = false;
		searchError = false;
		activeHit = -1;
		const normalized = query.trim();
		if (normalized.length < 2) {
			hits = [];
			resultKind = 'empty';
			correctedQuery = undefined;
			loading = false;
			return;
		}
		loading = true;
		timer = setTimeout(async () => {
			const current = query.trim();
			const scope: SearchScope = {
				kind: 'archive',
				label: 'во всём архиве',
				reportSlugs: scopeSlugs
			};
			try {
				const response = await searchScoped(current, [scope], 30);
				if (runId === requestId && current === query.trim()) {
					hits = response.hits;
					resultKind = response.matchKind;
					correctedQuery = response.correctedQuery;
					loading = false;
					// Transcript-шард ещё грузился — дозапустим запрос, когда доедет.
					if (response.pending) {
						void whenSearchComplete().then(() => {
							if (runId === requestId && current === query.trim()) scheduleSearch();
						});
					}
				}
			} catch {
				if (runId === requestId && current === query.trim()) {
					hits = [];
					resultKind = 'empty';
					correctedQuery = undefined;
					searchError = true;
					loading = false;
				}
			}
		}, 180);
	}

	$effect(() => {
		selections.authors;
		selections.places;
		selections.weapons;
		selections.collections;
		scopeSlugs;
		scheduleSearch();
	});

	function resultHref(hit: SearchHit, seek = false): string {
		const [pathname, hash] = hit.href.split('#');
		const params = new URLSearchParams({ q: query.trim() });
		if (seek && hit.start != null) params.set('t', String(Math.ceil(hit.start)));
		return `${base}${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
	}

	function openResult(event: MouseEvent, hit: SearchHit, seek: boolean) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		void goto(resultHref(hit, seek));
	}

	function resetFilters() {
		selections = { authors: [], places: [], weapons: [], collections: [] };
	}

</script>

<svelte:window onkeydown={handleWindowKeydown} />

	<section class="search-stage" aria-labelledby="archive-search-title">
	<div class="container search-stage-inner">
		<h1 id="archive-search-title">Найдите мысль в архиве</h1>
		<label class="search-field" onpointerenter={preloadSearchIndex}>
			<MagnifyingGlass size={30} weight="thin" aria-hidden="true" />
			<span class="sr-only">Поиск по архиву</span>
			<input
				type="search"
				aria-label="Поиск по архиву"
				bind:this={inputEl}
				bind:value={query}
				onfocus={preloadSearchIndex}
				oninput={scheduleSearch}
				onkeydown={onSearchKeydown}
				placeholder="Например: как подготовить атаку против позиционной защиты?"
				autocomplete="off"
				spellcheck="false"
			/>
			{#if loading}<span class="loading label" aria-hidden="true">ищем</span>{/if}
			<kbd class="search-kbd mono" aria-hidden="true">/</kbd>
		</label>
		<p class="sr-only" role="status" aria-live="polite">{statusText}</p>

		{#if activeFilters.length > 0 || (hasFilterGroups && query.trim().length < 2)}
		<div class="filter-controls">
			{#if hasFilterGroups && query.trim().length < 2}
				<button
					type="button"
					class="filter-trigger"
					aria-expanded={filterSheetOpen}
					onclick={openFilters}
				>
					<FunnelSimple size={19} weight="regular" aria-hidden="true" />
					<span>Фильтры</span>
					{#if activeFilterCount > 0}<span class="filter-badge mono">{activeFilterCount}</span>{/if}
				</button>
			{/if}
			<SearchFilterChips filters={activeFilters} onRemove={toggleFilter} />
		</div>
		{/if}
	</div>
</section>

{#if filterSheetOpen && hasFilterGroups}
	<button class="filter-backdrop" type="button" aria-label="Закрыть фильтры" onclick={closeFilters}></button>
	<div class="filter-sheet" role="dialog" aria-modal="true" aria-label="Фильтры поиска">
		<SearchFilterPanel
			groups={filterGroups}
			{selections}
			onToggle={toggleFilter}
			onClear={resetFilters}
			onClose={closeFilters}
		/>
	</div>
{/if}

{#if recentReports.length > 0 && query.trim().length < 2}
	<section class="container recent" aria-label="Недавно открывали">
		<span class="label">Недавно открывали</span>
		<ul>
			{#each recentReports as recent (recent.slug)}
				<li><a href="{base}/reports/{recent.slug}/">{recent.title}</a></li>
			{/each}
		</ul>
	</section>
{/if}

{#if query.trim().length >= 2}
	<section class="container results">
		<div class="results-layout">
		<div class="results-main">
		<div class="section-title">
			<h2>{resultsHeading}</h2>
			<div class="results-tools">
				<span class="label">{visibleHits.length} из {uniqueHits.length}</span>
				{#if hasFilterGroups}
					<button
						type="button"
						class="filter-trigger filter-trigger--compact"
						aria-expanded={filterSheetOpen}
						onclick={openFilters}
					>
						<FunnelSimple size={17} weight="regular" aria-hidden="true" />
						<span>Фильтры</span>
						{#if activeFilterCount > 0}<span class="filter-badge mono">{activeFilterCount}</span>{/if}
					</button>
				{/if}
			</div>
		</div>
		{#if correctedQuery && !loading && !searchError}
			<p class="search-note">Возможно, вы имели в виду «{correctedQuery}».</p>
		{/if}
		{#if searchError}
			<div class="search-error" role="alert">
				<p>Поиск временно недоступен.</p>
				<button type="button" onclick={scheduleSearch}>Повторить</button>
			</div>
		{:else if !loading && visibleHits.length === 0}
			<p class="empty">Ничего близкого не нашлось. Попробуйте описать мысль другими словами.</p>
		{:else}
			<ol class="result-list">
				{#each visibleHits as hit, index (uniqueHitKey(hit))}
					<li id={`hit-${index}`} class:kbd-active={activeHit === index}>
						<div class="result-copy">
							<p class="breadcrumb">{hit.reportTitle} <span>›</span> {hit.title}</p>
							<h3>{hit.title}</h3>
							{#if hit.matchReason?.length && hit.matchReasonKind !== 'correction'}
								<p class="match-reason"><span>{hit.matchReasonKind === 'tag' ? 'Метка отчёта' : 'Связано по смыслу'}</span> {hit.matchReason.join(' · ')}</p>
							{/if}
							<p class="snippet">
								{#each highlightParts(hit.snippet, query) as part}
									{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}
								{/each}
							</p>
						</div>
						<div class="result-actions">
							<span class="relevance label">релевантность {String(index + 1).padStart(2, '0')}</span>
							<a href={resultHref(hit)} onclick={(event) => openResult(event, hit, false)}><FileText size={21} weight="thin" />{hit.kind === 'report' ? 'Открыть отчёт' : 'Открыть блок'}<ArrowRight size={20} weight="thin" /></a>
							{#if hit.start != null}
								<a href={resultHref(hit, true)} onclick={(event) => openResult(event, hit, true)}><Play size={21} weight="thin" />Смотреть с {formatTime(hit.start)}<ArrowRight size={20} weight="thin" /></a>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
			{#if uniqueHits.length > 3}
				<button
					type="button"
					class="show-all"
					class:expanded={showAllHits}
					aria-expanded={showAllHits}
					onclick={() => (showAllHits = !showAllHits)}
				>
					<span>{showAllHits ? 'Свернуть до 3 совпадений' : `Показать все ${uniqueHits.length} совпадений`}</span>
					<CaretDown size={17} weight="bold" aria-hidden="true" />
				</button>
			{/if}
		{/if}
		</div>
		</div>
	</section>
{/if}

<section class="container catalog" aria-labelledby="collection-title">
	<div class="section-title">
		<h2 id="collection-title">Коллекции архива</h2>
		<span class="label">{collectionCountLabel(filteredCollections.length)}</span>
	</div>

	{#if filteredCollections.length === 0}
		<p class="empty">Нет коллекций с таким сочетанием фильтров.</p>
	{:else}
		<div class="catalog-grid">
			{#each primaryCollections as collection (collection.slug)}
				<CollectionCard {collection} />
			{/each}
		</div>
		{#if otherCollections.length}
			<div class="other-head">
				<h2>Другие темы</h2>
				<p>Материалы личного архива за пределами HEMA.</p>
			</div>
			<div class="catalog-grid catalog-grid--other">
				{#each otherCollections as collection (collection.slug)}
					<CollectionCard {collection} />
				{/each}
			</div>
		{/if}
	{/if}
</section>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.search-stage {
		margin-top: 8px;
	}

	.search-stage-inner {
		padding-top: clamp(28px, 5vw, 64px);
		padding-bottom: clamp(28px, 4vw, 48px);
		background: color-mix(in srgb, var(--paper-2) 72%, transparent);
		border-radius: var(--radius);
	}

	h1 {
		font-size: clamp(40px, 5vw, 68px);
		line-height: 1;
		margin-bottom: 28px;
	}

	.search-field {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 16px;
		min-height: 66px;
		padding: 0 20px;
		border: 1px solid var(--ink-faint);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--paper) 88%, transparent);
		color: var(--ink);
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.search-field:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent);
	}

	.search-field input {
		width: 100%;
		border: 0;
		outline: 0;
		background: transparent;
		font: inherit;
		font-size: clamp(18px, 2vw, 24px);
		color: var(--ink);
	}

	.search-field input::placeholder {
		color: var(--ink-faint);
		opacity: 1;
	}

	.loading {
		color: var(--accent);
	}

	.search-kbd {
		display: inline-grid;
		place-items: center;
		min-width: 24px;
		height: 24px;
		padding: 0 6px;
		border: 1px solid var(--line-strong);
		border-radius: 6px;
		color: var(--ink-faint);
		font-size: 12px;
	}

	.search-field:focus-within .search-kbd {
		display: none;
	}

	@media (hover: none), (max-width: 720px) {
		.search-kbd {
			display: none;
		}
	}

	.filter-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
	.filter-trigger { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 7px 12px; border: 1px solid var(--line-strong); border-radius: 999px; background: transparent; color: var(--ink-soft); font: inherit; font-size: 14px; cursor: pointer; }
	.filter-trigger--compact { min-height: 34px; padding: 5px 10px; font-size: 12px; }
	.filter-trigger:hover, .filter-trigger:focus-visible { border-color: var(--accent); color: var(--accent-ink); }
	.filter-trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
	.filter-badge { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: var(--accent); color: var(--paper); font-size: 10px; }
	.filter-backdrop { position: fixed; inset: 0; z-index: 80; width: 100%; height: 100%; border: 0; background: color-mix(in srgb, var(--ink) 28%, transparent); cursor: default; }
	.filter-sheet { position: fixed; z-index: 81; top: 0; right: 0; width: min(390px, calc(100vw - 28px)); height: 100dvh; overflow-y: auto; padding: 28px; border-left: 1px solid var(--line-strong); background: var(--paper); box-shadow: -18px 0 40px color-mix(in srgb, var(--ink) 12%, transparent); }

	.recent {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px 18px;
		margin-top: 26px;
	}

	.recent .label {
		color: var(--ink-faint);
	}

	.recent ul {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.recent a {
		color: var(--ink-soft);
		font-size: 15px;
		border-bottom: 1px solid var(--line-strong);
		transition: color 0.2s ease, border-color 0.2s ease;
	}

	.recent a:hover {
		color: var(--accent-ink);
		border-color: var(--accent);
	}

	.results,
	.catalog {
		padding-top: clamp(28px, 4vw, 52px);
	}

	.results-layout { display: block; }
	.results-main { min-width: 0; }
	.search-note { margin: 0; padding: 13px 0; border-bottom: 1px solid var(--line); color: var(--ink-soft); font-size: 14px; }
	.search-error { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 0; color: var(--ink-soft); }
	.search-error p { margin: 0; }
	.search-error button { min-height: 38px; padding: 6px 12px; border: 1px solid var(--line-strong); border-radius: 999px; background: transparent; color: var(--accent); font: inherit; cursor: pointer; }
	.search-error button:hover, .search-error button:focus-visible { border-color: var(--accent); }

	.section-title {
		display: flex;
		align-items: baseline;
		gap: 18px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--ink-soft);
	}

	.section-title h2,
	.other-head h2 {
		font-size: 22px;
		line-height: 1.2;
	}

	.section-title > span { margin-left: auto; }
	.results-tools { display: flex; align-items: center; gap: 14px; margin-left: auto; }
	.results-tools > span { flex: 0 0 auto; color: var(--ink-faint); white-space: nowrap; }

	.result-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.result-list li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(230px, 29%);
		gap: clamp(24px, 4vw, 56px);
		padding: 24px 0;
		border-bottom: 1px solid var(--line-strong);
	}

	/* Активный результат при навигации стрелками */
	.result-list li.kbd-active {
		background: color-mix(in srgb, var(--paper-2) 75%, transparent);
		box-shadow: inset 3px 0 0 var(--accent);
		padding-left: 14px;
		padding-right: 8px;
	}

	.breadcrumb {
		margin: 0 0 10px;
		font-size: 14px;
		color: var(--accent);
	}

	.breadcrumb span {
		padding: 0 5px;
		color: var(--ink-faint);
	}

	.result-copy h3 {
		font-size: clamp(24px, 2.4vw, 34px);
		line-height: 1.1;
		margin-bottom: 10px;
	}

	.snippet {
		max-width: 66ch;
		margin: 0;
		font-size: 17px;
		line-height: 1.58;
		color: var(--ink-soft);
	}

	.match-reason {
		display: flex;
		flex-wrap: wrap;
		gap: 5px 9px;
		margin: 0 0 7px;
		color: var(--ink-faint);
		font-size: 12px;
		line-height: 1.35;
	}

	.match-reason span {
		color: var(--accent);
		font-family: var(--font-ui);
		font-size: 10px;
		letter-spacing: .12em;
		text-transform: uppercase;
	}

	mark {
		background: color-mix(in srgb, var(--accent) 13%, var(--paper));
		color: var(--accent-ink);
		font-weight: 600;
	}

	.result-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-left: 24px;
		border-left: 1px solid var(--line-strong);
	}

	.relevance {
		margin-bottom: 4px;
	}

	.result-actions a {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
		padding: 7px 0;
		font-size: 17px;
		color: var(--accent);
	}

	.show-all {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 9px;
		width: 100%;
		min-height: 52px;
		margin-top: 18px;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius);
		background: transparent;
		color: var(--accent);
		font: inherit;
		font-size: 16px;
		cursor: pointer;
		transition: border-color 0.2s ease, background 0.2s ease;
	}

	.show-all:hover,
	.show-all:focus-visible {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 5%, transparent);
	}

	.show-all :global(svg) { transition: transform 0.2s ease; }
	.show-all.expanded :global(svg) { transform: rotate(180deg); }

	.empty {
		margin: 0;
		padding: 24px 0;
		color: var(--ink-soft);
	}

	.catalog-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: clamp(32px, 5vw, 72px);
	}

	.other-head {
		display: flex;
		align-items: baseline;
		gap: 16px;
		margin-top: 52px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--line-strong);
	}

	.other-head p {
		margin: 0;
		font-size: 15px;
		color: var(--ink-faint);
	}

	.catalog-grid--other {
		opacity: 0.86;
	}

	@media (max-width: 760px) {
		.search-stage {
			margin-top: 0;
		}

		.search-stage-inner {
			border-radius: 0;
		}

		h1 {
			margin-bottom: 20px;
		}

		.search-field {
			min-height: 58px;
			gap: 10px;
			padding: 0 14px;
		}

		.search-field input {
			font-size: 17px;
		}

		.filter-controls { align-items: flex-start; flex-direction: column; }
		.filter-sheet { top: auto; bottom: 0; width: 100%; height: auto; max-height: 84dvh; padding: 22px 20px 28px; border-top: 1px solid var(--line-strong); border-left: 0; border-radius: 16px 16px 0 0; box-shadow: 0 -18px 40px color-mix(in srgb, var(--ink) 12%, transparent); }

		.result-list li {
			grid-template-columns: 1fr;
			gap: 18px;
		}

		.result-actions {
			padding: 14px 0 0;
			border-top: 1px solid var(--line);
			border-left: 0;
		}

		.catalog-grid {
			grid-template-columns: 1fr;
		}

		.other-head {
			align-items: flex-start;
			flex-direction: column;
			gap: 6px;
		}
	}

	@media (max-width: 900px) {
		.results-tools { gap: 9px; }
	}
</style>

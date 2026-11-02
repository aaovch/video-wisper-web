<script lang="ts">
	import SearchResultItem from '$lib/components/SearchResultItem.svelte';
	import { searchHitKey as uniqueHitKey } from '$lib/search-hit-key';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createSearchController } from '$lib/search-controller.svelte';
	import { hasSearchQuery } from '$lib/search-tokenizer.js';
	import { base } from '$app/paths';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import FunnelSimple from 'phosphor-svelte/lib/FunnelSimple';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import { collectionReportFacets, collectionReportsMatchingFacets } from '$lib/collection-facets';
	import { groupCatalogCollections } from '$lib/catalog-groups';
	import CollectionCard from '$lib/components/CollectionCard.svelte';
	import SearchFilterChips from '$lib/components/SearchFilterChips.svelte';
	import SearchFilterDrawer from '$lib/components/SearchFilterDrawer.svelte';
	import { collections, collectionsForReport, reportGate, type Collection } from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';
	import type { SearchHit } from '$lib/search';
	import {
		activeSearchFilters,
		selectedFilterCount,
		type SearchFilterGroup
	} from '$lib/search-filters';
	import { readRecentReports } from '$lib/recent-reports';
	import { getReportSummary } from '$lib/data/report-meta';
	import {
		catalogReportSlugs,
		isReportLocked,
		searchableReportSlugs,
		visibleSubset
	} from '$lib/search-visibility';

	let { archived = false }: { archived?: boolean } = $props();
	const catalogCollections = $derived(
		collections.filter(
			(collection) => collection.hema && !collection.catalogHidden && Boolean(collection.archived) === archived
		)
	);
	const searchAreaLabel = $derived(archived ? 'в архиве' : 'в каталоге');
	const controller = createSearchController({
		defaults: { authors: [], places: [], weapons: [], collections: [] },
		scopes: () => [{ kind: 'archive', label: searchAreaLabel, reportSlugs: scopeSlugs }],
		limit: 30
	});
	const search = controller.state;
	function clearSearch() { controller.clear(); inputEl?.focus(); }

	let inputEl = $state<HTMLInputElement | null>(null);
	let activeHit = $state(-1);
	$effect(() => { search.query; search.selections; activeHit = -1; });

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
			options: catalogCollections.map((collection) => ({
				value: collection.slug,
				label: collection.title,
				count: new Set(collection.items).size
			}))
		}
	]);
	const activeFilters = $derived(activeSearchFilters(filterGroups, search.selections));
	const activeFilterCount = $derived(selectedFilterCount(search.selections));
	const hasFilterGroups = $derived(filterGroups.some((group) => group.options.length > 1));

	const filteredCollections = $derived(
		catalogCollections.filter(
			(collection) =>
				collectionReportsMatchingFacets(collection, search.selections).length > 0 &&
				(search.selections.collections.length === 0 || search.selections.collections.includes(collection.slug))
		)
	);
	const catalog = $derived(groupCatalogCollections(filteredCollections));
	const filtersActive = $derived(activeFilterCount > 0);
	const areaReportSlugs = $derived(catalogReportSlugs(archived ? 'archive' : 'main'));
	const visibleArchiveSlugs = $derived(searchableReportSlugs(lock.unlocked, archived ? 'archive' : 'main'));
	const recentReports = $derived(
		recentSlugs
			.filter((slug) => visibleArchiveSlugs.includes(slug))
			.map((slug) => getReportSummary(slug))
			.filter((summary): summary is NonNullable<typeof summary> => Boolean(summary))
			.slice(0, 5)
	);
	const scopeSlugs = $derived(
		filtersActive
			? visibleSubset(filteredCollections.flatMap((collection) => collectionReportsMatchingFacets(collection, search.selections)), areaReportSlugs)
			: areaReportSlugs
	);
	const uniqueHits = $derived.by(() => {
		const seen = new Set<string>();
		return search.hits
			.filter((hit) => {
				// A locked video is deliberately one opaque result: no separate chapter,
				// thesis or transcript rows until its password has been entered.
				const key = resultIsLocked(hit) ? `locked:${hit.reportSlug}` : uniqueHitKey(hit);
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
	});
	const visibleHits = $derived(search.expanded ? uniqueHits : uniqueHits.slice(0, 5));
	const resultsHeading = $derived.by(() => {
		if (search.matchKind === 'prefix') return `Совпадения по началу слова ${searchAreaLabel}`;
		if (search.matchKind === 'correction') return `Возможные совпадения ${searchAreaLabel}`;
		if (search.matchKind === 'semantic') return `Связанные по смыслу ${searchAreaLabel}`;
		return `Совпадения по запросу ${searchAreaLabel}`;
	});
	const statusText = $derived(
		search.loading
			? 'Ищем'
			: search.error
				? 'Поиск временно недоступен'
				: hasSearchQuery(search.query)
					? `${uniqueHits.length} совпадений`
					: ''
	);

	function uniqueFacet(key: 'authors' | 'places' | 'weapons'): string[] {
		return [
			...new Set(
				catalogCollections.flatMap((collection) => collection.facets?.[key] ?? []).filter(Boolean)
			)
		].sort((a, b) => a.localeCompare(b, 'ru'));
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (search.filterOpen && event.key === 'Escape') {
			event.preventDefault();
			controller.closeFilters();
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
			if (activeHit >= visibleHits.length - 1 && !search.expanded && uniqueHits.length > visibleHits.length) {
				search.expanded = true;
			}
			activeHit = Math.min(activeHit + 1, uniqueHits.length - 1);
			focusActiveHit();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeHit = Math.max(activeHit - 1, 0);
			focusActiveHit();
		} else if (event.key === 'Enter') {
			const hit = visibleHits[Math.max(activeHit, 0)];
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
				catalogCollections
					.filter((collection) => collection.facets?.[key]?.includes(value))
					.flatMap((collection) => collection.items.filter(slug => collectionReportFacets(collection, slug)[key]?.includes(value)))
			).size
		}));
	}

	function resultIsLocked(hit: SearchHit): boolean {
		return isReportLocked(hit.reportSlug, lock.unlocked);
	}

	function resultCollection(hit: SearchHit): Collection | undefined {
		const memberships = collectionsForReport(hit.reportSlug).filter(
			(collection) => Boolean(collection.archived) === archived
		);
		const gatedSlugs = new Set(reportGate(hit.reportSlug).map((target) => target.collectionSlug));
		return memberships.find((collection) => gatedSlugs.has(collection.slug)) ?? memberships[0];
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

	function resultHref(hit: SearchHit, seek = false): string {
		const [pathname, hash] = hit.href.split('#');
		const params = new URLSearchParams({ q: search.query.trim() });
		if (seek && hit.start != null) params.set('t', String(Math.ceil(hit.start)));
		return `${base}${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
	}

	function openResult(event: MouseEvent, hit: SearchHit, seek: boolean) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		void goto(resultHref(hit, seek));
	}

</script>

<svelte:window onkeydown={handleWindowKeydown} />

	<section class="search-stage" aria-labelledby="archive-search-title">
	<div class="container search-stage-inner">
		<nav class="catalog-navigation" aria-label="Раздел каталога">
			<a href="{base}/" aria-current={!archived ? 'page' : undefined}>Каталог</a>
			<a href="{base}/archive/" aria-current={archived ? 'page' : undefined}>Архив</a>
			<a href="{base}/stats/">Статистика</a>
		</nav>
		<h1 id="archive-search-title">{archived ? 'Архив' : 'Найдите мысль в каталоге'}</h1>
		<label class="search-field" onpointerenter={controller.preload}>
			<MagnifyingGlass size={30} weight="thin" aria-hidden="true" />
			<span class="sr-only">{archived ? 'Поиск по архиву' : 'Поиск по каталогу'}</span>
			<input
				type="search"
				aria-label={archived ? 'Поиск по архиву' : 'Поиск по каталогу'}
				bind:this={inputEl}
				bind:value={search.query}
				onfocus={controller.preload}
				oninput={controller.edit}
				onkeydown={onSearchKeydown}
				placeholder="Например: подготовка атаки"
				autocomplete="off"
				spellcheck="false"
			/>
			{#if search.loading}<span class="loading label" aria-hidden="true">ищем</span>{/if}
			<kbd class="search-kbd mono" aria-hidden="true">/</kbd>
		</label>
		<p class="sr-only" role="status" aria-live="polite">{statusText}</p>

		{#if activeFilters.length > 0 || (hasFilterGroups && !hasSearchQuery(search.query))}
		<div class="filter-controls">
			{#if hasFilterGroups && !hasSearchQuery(search.query)}
				<button
					type="button"
					class="filter-trigger"
					aria-expanded={search.filterOpen}
					onclick={controller.openFilters}
				>
					<FunnelSimple size={19} weight="regular" aria-hidden="true" />
					<span>Фильтры</span>
					{#if activeFilterCount > 0}<span class="filter-badge mono">{activeFilterCount}</span>{/if}
				</button>
			{/if}
			<SearchFilterChips filters={activeFilters} onRemove={controller.toggleFilter} />
		</div>
		{/if}
	</div>
</section>

<SearchFilterDrawer
	open={search.filterOpen && hasFilterGroups}
	groups={filterGroups}
	selections={search.selections}
	onToggle={controller.toggleFilter}
	onClear={controller.clearFilters}
	onClose={controller.closeFilters}
/>

{#if recentReports.length > 0 && !hasSearchQuery(search.query)}
	<section class="container recent" aria-label="Недавно открывали">
		<span class="label">Недавно открывали</span>
		<ul>
			{#each recentReports as recent (recent.slug)}
				<li><a href="{base}/reports/{recent.slug}/">{recent.title}</a></li>
			{/each}
		</ul>
	</section>
{/if}

{#if hasSearchQuery(search.query)}
	<section class="container results">
		<div class="results-layout">
		<div class="results-main">
		<div class="section-title search-results-heading">
			<h2>{resultsHeading}</h2>
			<div class="results-tools">
				{#if !search.loading}<span class="label">{visibleHits.length} из {uniqueHits.length}</span>{/if}
				{#if hasFilterGroups}
					<button
						type="button"
						class="filter-trigger filter-trigger--compact"
						aria-expanded={search.filterOpen}
						onclick={controller.openFilters}
					>
						<FunnelSimple size={17} weight="regular" aria-hidden="true" />
						<span>Фильтры</span>
						{#if activeFilterCount > 0}<span class="filter-badge mono">{activeFilterCount}</span>{/if}
					</button>
				{/if}
			</div>
		</div>
		{#if search.correctedQuery && !search.loading && !search.error}
			<p class="search-note">Возможно, вы имели в виду «{search.correctedQuery}».</p>
		{/if}
		{#if search.error}
			<div class="search-error" role="alert">
				<p>Поиск временно недоступен.</p>
				<button type="button" onclick={controller.retry}>Повторить</button>
			</div>
		{:else if !search.loading && visibleHits.length === 0}
			<div class="empty"><p>Ничего не найдено. Попробуйте короче или другое название.</p><button type="button" onclick={clearSearch}>Очистить поиск</button>{#if activeFilterCount > 0}<button type="button" onclick={controller.clearFilters}>Сбросить фильтры</button>{/if}</div>
		{:else}
			<ol class="result-list">
				{#each visibleHits as hit, index (uniqueHitKey(hit))}
					{@const lockedResult = resultIsLocked(hit)}
					{@const hitCollection = resultCollection(hit)}
					<SearchResultItem
						id={`hit-${index}`}
						{hit}
						query={search.query}
						scope={search.scope}
						layout="archive"
						locked={lockedResult}
						lockedCollectionTitle={hitCollection?.title ?? ''}
						active={activeHit === index}
						hrefFor={resultHref}
						onOpen={openResult}
					/>
				{/each}
			</ol>
			{#if uniqueHits.length > 5}
				<button
					type="button"
					class="show-all"
					class:expanded={search.expanded}
					aria-expanded={search.expanded}
					onclick={() => { search.expanded = !search.expanded; controller.save(); }}
				>
					<span>{search.expanded ? 'Свернуть до 5 совпадений' : `Показать все ${uniqueHits.length} совпадений`}</span>
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
		<h2 id="collection-title">{hasSearchQuery(search.query) ? 'Все коллекции' : archived ? 'Коллекции архива' : 'Коллекции'}</h2>
		<span class="label">{collectionCountLabel(filteredCollections.length)}</span>
	</div>

	{#if filteredCollections.length === 0}
		<p class="empty">Нет коллекций с таким сочетанием фильтров.</p>
	{:else}
		{#each catalog.groups as group (group.id)}
			<section class="collection-group" aria-labelledby={`catalog-group-${group.id}`}>
				<div class="collection-group__head">
					<div>
						<p class="label">{group.label}</p>
						<h3 id={`catalog-group-${group.id}`}>{group.title}</h3>
					</div>
					{#if group.description}<p>{group.description}</p>{/if}
				</div>
				<div class="catalog-grid">
					{#each group.collections as collection (collection.slug)}
						<CollectionCard {collection} />
					{/each}
				</div>
			</section>
		{/each}
		{#if catalog.standalone.length}
			<div class="catalog-grid">
				{#each catalog.standalone as collection (collection.slug)}
					<CollectionCard {collection} />
				{/each}
			</div>
		{/if}
	{/if}
</section>

<style>
	.empty button { min-height: 44px; margin: 8px 12px 0 0; padding: 8px 12px; background: transparent; border: 1px solid var(--line-strong); border-radius: var(--radius); color: var(--accent-ink); font: inherit; cursor: pointer; }
	.empty button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
	.catalog-navigation { display: flex; gap: 24px; margin-bottom: 24px; }
	.catalog-navigation a { padding: 8px 0; color: var(--ink-soft); }
	.catalog-navigation a[aria-current="page"] { color: var(--accent); border-bottom: 1px solid currentColor; }
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

	@media (hover: none), (max-width: 760px) {
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

	.section-title h2 {
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

	.collection-group {
		margin-bottom: 52px;
		padding: clamp(22px, 3vw, 34px);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--paper-2) 64%, transparent);
	}

	.collection-group__head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 32px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--line-strong);
	}

	.collection-group__head .label {
		margin: 0 0 6px;
	}

	.collection-group__head h3 {
		font-size: clamp(30px, 4vw, 44px);
		line-height: 1;
	}

	.collection-group__head > p {
		max-width: 52ch;
		margin: 0;
		color: var(--ink-soft);
		font-size: 15px;
		line-height: 1.5;
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
		.catalog-grid {
			grid-template-columns: 1fr;
		}

		.collection-group {
			margin-bottom: 36px;
			padding: 20px 16px;
		}

		.collection-group__head {
			align-items: flex-start;
			flex-direction: column;
			gap: 10px;
		}

	}

	@media (max-width: 960px) {
		.results-tools { gap: 9px; }
	}
</style>

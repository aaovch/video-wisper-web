<script lang="ts">
	import SearchResultItem from '$lib/components/SearchResultItem.svelte';
	import { searchHitKey as uniqueHitKey } from '$lib/search-hit-key';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { createSearchController } from '$lib/search-controller.svelte';
	import { hasSearchQuery } from '$lib/search-tokenizer.js';
	import { base } from '$app/paths';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import FunnelSimple from 'phosphor-svelte/lib/FunnelSimple';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import SearchFilterChips from '$lib/components/SearchFilterChips.svelte';
	import SearchFilterDrawer from '$lib/components/SearchFilterDrawer.svelte';
	import { getCollection } from '$lib/data/collections';
	import { buildReportFacetMap } from '$lib/collection-facets';
	import { lock } from '$lib/lock.svelte';
	import {
		type SearchHit,
		type SearchScope,
		type SearchZone
	} from '$lib/search';
	import {
		activeSearchFilters,
		selectedFilterCount,
		type SearchFilterGroup,
		type SearchFilterSelections
	} from '$lib/search-filters';
	import { searchableReportSlugs, visibleSubset } from '$lib/search-visibility';

	let {
		kind,
		reportSlug = '',
		reportSlugs = [],
		collectionSlug = '',
		language = 'ru',
		onCollectionFilterChange,
		onHit,
		onResults
	}: {
		kind: 'collection' | 'report';
		reportSlug?: string;
		reportSlugs?: string[];
		collectionSlug?: string;
		language?: 'ru' | 'en';
		onCollectionFilterChange?: (reportSlugs: string[]) => void;
		onHit?: (hit: SearchHit, seek: boolean, href: string) => void;
		onResults?: (hits: SearchHit[], loading: boolean) => void;
	} = $props();

	const controller = createSearchController({
		defaults: { zones: [], sections: [], authors: [], places: [], weapons: [] },
		scopes: buildSearchScopes,
		limit: 120,
		preserveHashScroll: () => kind === 'report' && Boolean(page.url.hash)
	});
	const search = controller.state;
	function clearSearch() { controller.clear(); searchInput?.focus(); }
	let searchInput: HTMLInputElement;

	const label = $derived(language === 'en' ? (kind === 'report' ? 'Search this report' : 'Search this collection') : (kind === 'report' ? 'Поиск в отчёте' : 'Поиск в коллекции'));
	const placeholder = $derived(`${label}…`);
	const activeCollection = $derived(getCollection(collectionSlug));
	const scopedCollection = $derived(kind === 'collection' ? activeCollection : undefined);
	const visibleArchiveSlugs = $derived(searchableReportSlugs(lock.unlocked));
	const visibleCollectionSlugs = $derived(visibleSubset(reportSlugs, searchableReportSlugs(lock.unlocked, 'all')));
	const reportFacetMap = $derived.by(() => buildReportFacetMap(activeCollection, reportSlugs));
	// Cards remain available as entry points to password-protected reports.
	const filteredCardSlugs = $derived(
		kind === 'collection'
			? reportSlugs.filter((slug) => reportMatchesCollectionFilters(slug))
			: reportSlugs
	);
	const filteredCollectionSlugs = $derived(visibleSubset(filteredCardSlugs, visibleCollectionSlugs));
	const filterGroups = $derived.by<SearchFilterGroup[]>(() =>
		kind === 'report' ? reportFilterGroups(search.hits, search.selections) : collectionFilterGroups()
	);
	const activeFilters = $derived(activeSearchFilters(filterGroups, search.selections));
	const activeFilterCount = $derived(selectedFilterCount(search.selections));
	const hasFilterGroups = $derived(
		filterGroups.some(
			(group) =>
				group.options.length > 1 ||
				group.options.some((option) => search.selections[group.id]?.includes(option.value))
		)
	);
	const filteredHits = $derived(search.hits.filter(hitMatchesFilters));
	const uniqueHits = $derived.by(() => {
		const seen = new Set<string>();
		return filteredHits
			.filter((hit) => {
				const key = uniqueHitKey(hit);
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
	});
	$effect(() => { onResults?.(search.loading ? [] : uniqueHits, search.loading); });
	const visibleHits = $derived(search.expanded ? uniqueHits : uniqueHits.slice(0, 5));
	const resultsHeading = $derived.by(() => {
		const suffix = '';
		if (language === 'en') {
			if (search.matchKind === 'prefix') return `Word-prefix matches ${suffix}`;
			if (search.matchKind === 'correction') return `Possible matches ${suffix}`;
			if (search.matchKind === 'semantic') return `Semantically related ${suffix}`;
			return 'Results';
		}
		if (search.matchKind === 'prefix') return `Совпадения по началу слова ${suffix}`;
		if (search.matchKind === 'correction') return `Возможные совпадения ${suffix}`;
		if (search.matchKind === 'semantic') return `Связанные по смыслу ${suffix}`;
		return 'Результаты';
	});
	const statusText = $derived(
		search.loading
			? language === 'en' ? 'Searching' : 'Ищем'
			: search.error
				? language === 'en' ? 'Search is temporarily unavailable' : 'Поиск временно недоступен'
				: hasSearchQuery(search.query)
					? language === 'en' ? `${uniqueHits.length} matches` : `${uniqueHits.length} совпадений`
					: ''
	);

	function handleWindowKeydown(event: KeyboardEvent) {
		if (search.filterOpen && event.key === 'Escape') {
			event.preventDefault();
			controller.closeFilters();
		}
	}

	function matchCountLabel(count: number): string {
		if (language === 'en') return count === 1 ? 'match' : 'matches';
		const mod100 = count % 100;
		if (mod100 >= 11 && mod100 <= 14) return 'совпадений';
		const mod10 = count % 10;
		if (mod10 === 1) return 'совпадение';
		if (mod10 >= 2 && mod10 <= 4) return 'совпадения';
		return 'совпадений';
	}

	function facetOptions(key: 'authors' | 'places' | 'weapons') {
		const values = new Set<string>();
		for (const facets of reportFacetMap.values()) for (const value of facets[key]) values.add(value);
		return [...values]
			.sort((a, b) => a.localeCompare(b, 'ru'))
			.map((value) => ({
				value,
				label: value,
				count: [...reportFacetMap.values()].filter((facets) => facets[key].has(value)).length
			}));
	}

	function collectionFilterGroups(): SearchFilterGroup[] {
		const groups: SearchFilterGroup[] = [];
		if (scopedCollection?.sections?.length) {
			groups.push({
				id: 'sections',
				label: language === 'en' ? 'Section' : 'Раздел',
				options: scopedCollection.sections.map((section) => ({
					value: section.title,
					label: section.title,
					count: section.items.length
				}))
			});
		}
		for (const [id, groupLabel] of [
			['authors', language === 'en' ? 'Author' : 'Автор'],
			['places', language === 'en' ? 'Place' : 'Место'],
			['weapons', language === 'en' ? 'Weapon' : 'Оружие']
		] as const) groups.push({ id, label: groupLabel, options: facetOptions(id) });
		return groups;
	}

	const zoneLabels = $derived(language === 'en' ? {
		chapters: 'Chapters',
		theses: 'Key points',
		transcript: 'Transcript',
		additional: 'Additional materials'
	} : {
		chapters: 'Главы',
		theses: 'Тезисы',
		transcript: 'Расшифровка',
		additional: 'Дополнительные материалы'
	});

	function reportFilterGroups(results: SearchHit[], current: SearchFilterSelections): SearchFilterGroup[] {
		const selectedZones = current.zones ?? [];
		const options = Object.entries(zoneLabels)
			.map(([value, optionLabel]) => ({
				value,
				label: optionLabel,
				count: results.filter((hit) => hit.zone === value).length
			}))
			.filter((option) => option.count > 0 || selectedZones.includes(option.value));
		return options.length ? [{ id: 'zones', label: language === 'en' ? 'Search area' : 'Зона поиска', options }] : [];
	}

	function reportMatchesCollectionFilters(slug: string): boolean {
		if (kind !== 'collection') return true;
		if (search.selections.sections.length > 0) {
			const matchesSection = scopedCollection?.sections?.some(
				(section) => search.selections.sections.includes(section.title) && section.items.includes(slug)
			);
			if (!matchesSection) return false;
		}

		const facets = reportFacetMap.get(slug);
		for (const key of ['authors', 'places', 'weapons'] as const) {
			const selected = search.selections[key] ?? [];
			if (selected.length > 0 && !selected.some((value) => facets?.[key].has(value))) return false;
		}
		return true;
	}

	function hitMatchesFilters(hit: SearchHit): boolean {
		if (search.selections.zones.length > 0 && !search.selections.zones.includes(hit.zone)) return false;
		return reportMatchesCollectionFilters(hit.reportSlug);
	}

	function buildSearchScopes(): SearchScope[] {
		const archiveScope: SearchScope = {
			kind: 'archive',
			label: language === 'en' ? 'across the full archive' : 'во всём архиве',
			reportSlugs: visibleArchiveSlugs
		};
		if (kind === 'report') {
			const scopes: SearchScope[] = [{
				kind: 'report',
				label: language === 'en' ? 'in this report' : 'в этом отчёте',
				reportSlug,
				zones: search.selections.zones.length ? search.selections.zones as SearchZone[] : undefined
			}];
			if (activeFilterCount > 0) return scopes;
			const siblingSlugs = visibleCollectionSlugs.filter((slug) => slug !== reportSlug);
			if (activeCollection && siblingSlugs.length) {
				scopes.push({
					kind: 'collection',
					label: language === 'en' ? `in the “${activeCollection.title}” collection` : `в коллекции «${activeCollection.title}»`,
					reportSlugs: siblingSlugs
				});
			}
			if (!activeCollection?.isolated) scopes.push(archiveScope);
			return scopes;
		}

		const scopes: SearchScope[] = [{
			kind: 'collection',
			label: language === 'en' ? (activeCollection ? `in the “${activeCollection.title}” collection` : 'in this collection') : (activeCollection ? `в коллекции «${activeCollection.title}»` : 'в этой коллекции'),
			reportSlugs: filteredCollectionSlugs
		}];
		if (activeFilterCount === 0 && !activeCollection?.isolated) scopes.push(archiveScope);
		return scopes;
	}

	$effect(() => {
		if (kind === 'collection') onCollectionFilterChange?.(filteredCardSlugs);
	});

	function resultHref(hit: SearchHit, seek = false): string {
		const [pathname, hash] = hit.href.split('#');
		const params = new URLSearchParams({ q: search.query.trim() });
		if (collectionSlug) params.set('from', collectionSlug);
		if (seek && hit.start != null) params.set('t', String(Math.ceil(hit.start)));
		return `${base}${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
	}

	function openResult(event: MouseEvent, hit: SearchHit, seek: boolean) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		const href = resultHref(hit, seek);
		if (kind === 'report' && hit.reportSlug === reportSlug && onHit) {
			onHit(hit, seek, href);
			return;
		}
		void goto(href);
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<section id="report-search" class="scope-search" class:report-scope={kind === 'report'} aria-label={label}>
	<label class="search-field">
		<MagnifyingGlass size={25} weight="thin" aria-hidden="true" />
		<span class="sr-only">{label}</span>
		<input
			type="search"
			aria-label={label}
			bind:this={searchInput}
			bind:value={search.query}
			onkeydown={(event) => { if (event.key === 'Enter' && visibleHits[0]) { event.preventDefault(); const hit = visibleHits[0]; if (kind === 'report' && hit.reportSlug === reportSlug && onHit) onHit(hit, false, resultHref(hit)); else void goto(resultHref(hit)); } }}
			onfocus={controller.preload}
			oninput={controller.edit}
			{placeholder}
			autocomplete="off"
			spellcheck="false"
		/>
		{#if search.loading}<span class="loading label" aria-hidden="true">{language === 'en' ? 'searching' : 'ищем'}</span>{/if}
	</label>
	<p class="sr-only" role="status" aria-live="polite">{statusText}</p>

	{#if !search.fallback && (activeFilters.length > 0 || (hasFilterGroups && !hasSearchQuery(search.query)))}
		<div class="filter-controls">
			{#if hasFilterGroups && !hasSearchQuery(search.query)}
				<button
					type="button"
					class="filter-trigger"
					aria-expanded={search.filterOpen}
					onclick={controller.openFilters}
				>
					<FunnelSimple size={18} weight="regular" aria-hidden="true" />
					<span>{language === 'en' ? 'Filters' : 'Фильтры'}</span>
					{#if activeFilterCount > 0}<span class="filter-badge mono">{activeFilterCount}</span>{/if}
				</button>
			{/if}
			<SearchFilterChips filters={activeFilters} onRemove={controller.toggleFilter} {language} />
		</div>
	{/if}

	<SearchFilterDrawer
		open={search.filterOpen && hasFilterGroups}
		groups={filterGroups}
		selections={search.selections}
		onToggle={controller.toggleFilter}
		onClear={controller.clearFilters}
		onClose={controller.closeFilters}
		{language}
	/>

	{#if hasSearchQuery(search.query)}
		<div class="results">
			<div class="results-layout">
				<div class="results-main">
					<div class="results-head search-results-heading">
						<p>{resultsHeading}</p>
						<div class="results-tools">
							{#if !search.loading}<span class="label">{visibleHits.length} {language === 'en' ? 'of' : 'из'} {uniqueHits.length}</span>{/if}
							{#if hasFilterGroups && !search.fallback}
								<button
									type="button"
									class="filter-trigger filter-trigger--compact"
									aria-expanded={search.filterOpen}
									onclick={controller.openFilters}
								>
									<FunnelSimple size={16} weight="regular" aria-hidden="true" />
									<span>{language === 'en' ? 'Filters' : 'Фильтры'}</span>
									{#if activeFilterCount > 0}<span class="filter-badge mono">{activeFilterCount}</span>{/if}
								</button>
							{/if}
						</div>
					</div>
					{#if search.fallback}
						<p class="scope-note">
							{language === 'en'
								? `${kind === 'report' ? 'This report' : 'This collection'} has no exact or word-prefix matches. Showing results ${search.scopeLabel}.`
								: `${kind === 'report' ? 'В этом отчёте' : 'В этой коллекции'} точных совпадений и совпадений по началу слова нет. Показываем результаты ${search.scopeLabel}.`}
						</p>
					{/if}
			{#if search.correctedQuery && !search.loading && !search.error}
				<p class="scope-note">{language === 'en' ? `Did you mean “${search.correctedQuery}”?` : `Возможно, вы имели в виду «${search.correctedQuery}».`}</p>
			{/if}
			{#if search.error}
				<div class="search-error" role="alert">
					<p>{language === 'en' ? 'Search is temporarily unavailable.' : 'Поиск временно недоступен.'}</p>
					<button type="button" onclick={controller.retry}>{language === 'en' ? 'Retry' : 'Повторить'}</button>
				</div>
			{:else if !search.loading && visibleHits.length === 0}
				<div class="empty"><p>{language === 'en' ? 'Nothing found. Try a shorter query or a different term.' : 'Ничего не найдено. Попробуйте короче или другое название.'}</p><button type="button" onclick={clearSearch}>{language === 'en' ? 'Clear search' : 'Очистить поиск'}</button>{#if activeFilterCount > 0}<button type="button" onclick={controller.clearFilters}>{language === 'en' ? 'Reset filters' : 'Сбросить фильтры'}</button>{/if}</div>
			{:else}
				<ol>
					{#each visibleHits as hit (uniqueHitKey(hit))}
						<SearchResultItem
							{hit}
							query={search.query}
							scope={search.scope}
							layout={kind === 'report' ? 'report' : 'scoped'}
							showReportTitle={kind !== 'report' || hit.reportSlug !== reportSlug}
							hrefFor={resultHref}
							onOpen={openResult}
							{language}
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
						<span>{language === 'en' ? (search.expanded ? 'Collapse to 5 matches' : `Show all ${uniqueHits.length} ${matchCountLabel(uniqueHits.length)}`) : (search.expanded ? 'Свернуть до 5 совпадений' : `Показать все ${uniqueHits.length} ${matchCountLabel(uniqueHits.length)}`)}</span>
						<CaretDown size={16} weight="bold" aria-hidden="true" />
					</button>
				{/if}
			{/if}
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.empty button { min-height: 44px; margin: 8px 12px 0 0; padding: 8px 12px; background: transparent; border: 1px solid var(--line-strong); border-radius: var(--radius); color: var(--accent-ink); font: inherit; cursor: pointer; }
	.empty button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
	.scope-search { container-type: inline-size; }
	.search-field { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 13px; min-height: 58px; padding: 0 17px; border: 1px solid var(--ink-faint); border-radius: var(--radius); background: color-mix(in srgb, var(--paper) 90%, transparent); transition: border-color .2s ease, box-shadow .2s ease; }
	.search-field:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent); }
	input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: clamp(17px, 1.6vw, 21px); color: var(--ink); }
	input::placeholder { color: var(--ink-faint); opacity: 1; }
	.loading { color: var(--accent); }
	.filter-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; margin-top: 12px; }
	.filter-trigger { display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 6px 11px; border: 1px solid var(--line-strong); border-radius: 999px; background: transparent; color: var(--ink-soft); font: inherit; font-size: 13px; cursor: pointer; }
	.filter-trigger--compact { min-height: 32px; padding: 4px 9px; font-size: 12px; }
	.filter-trigger:hover, .filter-trigger:focus-visible { border-color: var(--accent); color: var(--accent-ink); }
	.filter-trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
	.filter-badge { display: inline-grid; place-items: center; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px; background: var(--accent); color: var(--paper); font-size: 10px; }
	.results { margin-top: 20px; }
	.results-layout { display: block; }
	.results-main { min-width: 0; border-top: 1px solid var(--line-strong); }
	.results-head { display: flex; align-items: baseline; gap: 16px; padding: 13px 0; border-bottom: 1px solid var(--line); }
	.results-head p { margin: 0; font-size: 15px; }
	.scope-note { margin: 0; padding: 14px 0; border-bottom: 1px solid var(--line); color: var(--ink-soft); font-size: 14px; line-height: 1.45; }
	.search-error { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 0; color: var(--ink-soft); }
	.search-error p { margin: 0; }
	.search-error button { min-height: 38px; padding: 6px 12px; border: 1px solid var(--line-strong); border-radius: 999px; background: transparent; color: var(--accent); font: inherit; cursor: pointer; }
	.search-error button:hover, .search-error button:focus-visible { border-color: var(--accent); }
	.results-tools { display: flex; align-items: center; gap: 10px; margin-left: auto; }
	.results-tools > span { flex: 0 0 auto; color: var(--ink-faint); white-space: nowrap; }
	ol { margin: 0; padding: 0; list-style: none; }
	.show-all { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 46px; margin-top: 14px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: transparent; color: var(--accent); font: inherit; font-size: 14px; cursor: pointer; transition: border-color .2s ease, background .2s ease; }
	.show-all:hover, .show-all:focus-visible { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 5%, transparent); }
	.show-all:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
	.show-all :global(svg) { transition: transform .2s ease; }
	.show-all.expanded :global(svg) { transform: rotate(180deg); }
	.empty { margin: 0; padding: 18px 0; color: var(--ink-soft); }

	@container (max-width: 520px) {
		.search-field { min-height: 54px; padding: 0 13px; }
		input { font-size: 16px; }
		.filter-controls { align-items: flex-start; flex-direction: column; }
	}

	@container (max-width: 760px) {
		.results-tools { gap: 8px; }
	}
</style>

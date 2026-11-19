<script lang="ts">
	import { Input } from '@ui-sdk/svelte/input';
	import { Button } from '@ui-sdk/svelte/button';
	import { browser } from '$app/environment';
	import { russianPlural } from '$lib/utils';
	import SearchResultItem from '$lib/components/SearchResultItem.svelte';
	import { searchHitKey as uniqueHitKey } from '$lib/search-hit-key';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { createSearchController } from '$lib/search-controller.svelte';
	import { hasSearchQuery } from '$lib/search-tokenizer.js';
	import { base } from '$app/paths';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import SearchFilters from './SearchFilters.svelte';
	import { getCollection } from '$lib/data/collections';
	import { buildReportFacetMap } from '$lib/collection-facets';
	import { lock } from '$lib/lock.svelte';
	import { communityArchive } from '$lib/site';
	import { canAccessReport } from '$lib/data/collections';
	import {
		type SearchHit,
		type SearchScope,
		type SearchZone
	} from '$lib/search';
	import {
		selectedFilterCount,
		type SearchFilterGroup,
		type SearchFilterSelections
	} from '$lib/search-filters';
	import { discoverableReportSlugs, searchableReportSlugs, visibleSubset } from '$lib/search-visibility';

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
	function applyCorrection() {
		if (!search.correctedQuery) return;
		search.query = search.correctedQuery;
		controller.edit();
		searchInput?.focus();
	}
	function clearSearch() { controller.clear(); searchInput?.focus(); }
	let searchInput: HTMLInputElement;
	let reportResultsRequested = $state(false);
	const showResults = $derived(kind !== 'report' || !browser || !page.url.searchParams.has('archiveSearch') || reportResultsRequested);

	const label = $derived(language === 'en' ? (kind === 'report' ? 'Search this recording' : 'Search this collection') : (kind === 'report' ? 'Поиск по записи' : 'Поиск по коллекции'));
	const activeCollection = $derived(getCollection(collectionSlug));
	const scopedCollection = $derived(kind === 'collection' ? activeCollection : undefined);
	const visibleArchiveSlugs = $derived(communityArchive ? discoverableReportSlugs(lock.unlocked) : searchableReportSlugs(lock.unlocked));
	const visibleCollectionSlugs = $derived(visibleSubset(reportSlugs, communityArchive ? discoverableReportSlugs(lock.unlocked, 'all') : searchableReportSlugs(lock.unlocked, 'all')));
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
	const activeFilterCount = $derived(selectedFilterCount(search.selections));
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
		if (language === 'en') {
			if (search.matchKind === 'prefix') return `Word-prefix matches`;
			if (search.matchKind === 'correction') return `Possible matches`;
			if (search.matchKind === 'semantic') return `Semantically related`;
			return 'Results';
		}
		if (search.matchKind === 'prefix') return `Совпадения по началу слова`;
		if (search.matchKind === 'correction') return `Возможные совпадения`;
		if (search.matchKind === 'semantic') return `Связанные по смыслу`;
		return 'Результаты';
	});
	const statusText = $derived(
		search.loading
			? language === 'en' ? 'Searching' : 'Ищем'
			: search.error
				? language === 'en' ? 'Search is temporarily unavailable' : 'Поиск временно недоступен'
				: hasSearchQuery(search.query)
					? `${search.total} ${matchCountLabel(search.total)}`
					: ''
	);


	function matchCountLabel(count: number): string {
		if (language === 'en') return count === 1 ? 'match' : 'matches';
		return russianPlural(count, ['совпадение', 'совпадения', 'совпадений']);
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
		return options.length ? [{ id: 'zones', label: language === 'en' ? 'Search area' : 'Где искать', options }] : [];
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
				label: language === 'en' ? 'in this recording' : 'в этой записи',
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
			reportSlugs: filteredCollectionSlugs,
			zones: search.selections.zones.length ? search.selections.zones as SearchZone[] : undefined
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
		if (seek && hit.start != null) params.set('t', String(hit.start));
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



<section id="report-search" class="scope-search" class:report-scope={kind === 'report'} aria-label={label}>
	<label class="search-field">
		<MagnifyingGlass size={25} weight="thin" aria-hidden="true" />
		<span class="sr-only">{label}</span>
		<Input type="search" aria-label={label} bind:value={() => search.query, (query) => { search.query = query; controller.edit(); }} onkeydown={(event) => { if (event.key === 'Enter' && !event.isComposing && !search.loading && visibleHits[0]) { event.preventDefault(); const hit = visibleHits[0]; if (kind === 'report' && hit.reportSlug === reportSlug && onHit) onHit(hit, false, resultHref(hit)); else void goto(resultHref(hit)); } }} onfocus={() => { controller.preload(); reportResultsRequested = true; }} placeholder={label} autocomplete="off" spellcheck="false">
			{#snippet render({ props })}
				<input {...props} bind:this={searchInput} />
			{/snippet}
		</Input>
		{#if search.loading}<span class="loading label" aria-hidden="true">{language === 'en' ? 'searching' : 'ищем'}</span>{/if}
	</label>
	<p class="sr-only" role="status" aria-live="polite">{statusText}</p>

	{#if showResults && (kind === 'collection' || !search.fallback)}
		<SearchFilters groups={filterGroups} selections={search.selections} onToggle={controller.toggleFilter} onClear={controller.clearFilters} {language} />
	{/if}

	{#if hasSearchQuery(search.query) && !showResults}
		<Button type="button" onclick={() => reportResultsRequested = true}>
			{#snippet render({ props })}
				<button {...props} class="show-all">{language === 'en' ? 'Show matches in this recording' : 'Показать совпадения в записи'}</button>
			{/snippet}
		</Button>
	{/if}
	{#if hasSearchQuery(search.query) && showResults}
		<div class="results">
			<div class="results-layout">
				<div class="results-main">
					<div class="results-head search-results-heading">
						<p>{resultsHeading}</p>
						<div class="results-tools">
							{#if !search.loading && search.total > 0}<span class="label">{visibleHits.length < search.total ? `${visibleHits.length} ${language === 'en' ? 'of' : 'из'} ${search.total}` : search.total}</span>{/if}
						</div>
					</div>
					{#if search.fallback}
						<p class="scope-note">
							{language === 'en' ? `Showing matches ${search.scopeLabel}.` : `Найдены совпадения ${search.scopeLabel}.`}
						</p>
					{/if}
			{#if search.correctedQuery && !search.loading && !search.error}
				<p class="scope-note">{language === 'en' ? 'Did you mean' : 'Возможно, вы имели в виду'} <Button onclick={applyCorrection}>
					{#snippet render({ props })}
						<button {...props} class="correction">{search.correctedQuery}</button>
					{/snippet}
				</Button>?</p>
			{/if}
			{#if search.error}
				<div class="search-error" role="alert">
					<p>{language === 'en' ? 'Search is temporarily unavailable.' : 'Поиск временно недоступен.'}</p>
					<Button type="button" onclick={controller.retry}>
						{#snippet render({ props })}
							<button {...props}>{language === 'en' ? 'Retry' : 'Повторить'}</button>
						{/snippet}
					</Button>
				</div>
			{:else if !search.loading && visibleHits.length === 0}
				<div class="empty"><p>{language === 'en' ? 'Nothing found. Try a shorter query or a different term.' : 'Ничего не найдено. Попробуйте короче или другое название.'}</p><Button type="button" onclick={clearSearch}>
					{#snippet render({ props })}
						<button {...props}>{language === 'en' ? 'Clear search' : 'Очистить поиск'}</button>
					{/snippet}
				</Button>{#if activeFilterCount > 0}<Button type="button" onclick={controller.clearFilters}>
					{#snippet render({ props })}
						<button {...props}>{language === 'en' ? 'Reset filters' : 'Сбросить фильтры'}</button>
					{/snippet}
				</Button>{/if}</div>
			{:else}
				<ol inert={search.loading} aria-busy={search.loading}>
					{#each visibleHits as hit (uniqueHitKey(hit))}
						<SearchResultItem
							{hit}
							query={search.query}
							scope={search.scope}
							layout={kind === 'report' ? 'report' : 'scoped'}
							locked={!canAccessReport(hit.reportSlug, lock.unlocked)}
							showReportTitle={kind !== 'report' || hit.reportSlug !== reportSlug}
							hrefFor={resultHref}
							onOpen={openResult}
							{language}
						/>
					{/each}
				</ol>
				{#if search.total > 5}
					<Button type="button" aria-expanded={search.expanded} onclick={controller.toggleExpanded}>
						{#snippet render({ props })}
							<button {...props} class="show-all" class:expanded={search.expanded}>
						<span>{language === 'en' ? (search.expanded ? 'Collapse to 5 matches' : `Show all ${search.total} ${matchCountLabel(search.total)}`) : (search.expanded ? 'Свернуть до 5 совпадений' : `Показать ${search.total} ${matchCountLabel(search.total)}`)}</span>
						<CaretDown size={16} weight="bold" aria-hidden="true" />
					</button>
						{/snippet}
					</Button>
				{/if}
			{/if}
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.correction { font: inherit; color: var(--accent-ink); text-decoration: underline; background: transparent; border: 0; cursor: pointer; }
	.empty button { min-height: 44px; margin: 8px 12px 0 0; padding: 8px 12px; background: transparent; border: 1px solid var(--line-strong); border-radius: var(--radius); color: var(--accent-ink); font: var(--text-control)/1.4 var(--font-ui); cursor: pointer; }
	.empty button:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
	.scope-search { container-type: inline-size; }
	.search-field { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 13px; min-height: 58px; padding: 0 17px; border: 1px solid var(--ink-faint); border-radius: var(--radius); background: color-mix(in srgb, var(--paper) 90%, transparent); transition: border-color .2s ease, box-shadow .2s ease; }
	.search-field:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent); }
	input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: clamp(17px, 1.6vw, 21px); color: var(--ink); }
	input::placeholder { color: var(--ink-faint); opacity: 1; }
	.loading { color: var(--accent); }
	ol[aria-busy='true'] { min-height: 18rem; opacity: 0.65; }
	.results { margin-top: 20px; }
	.results-layout { display: block; }
	.results-main { min-width: 0; }
	.results-head { display: flex; align-items: baseline; gap: 16px; padding: 13px 0 0; }
	.results-head p { margin: 0; font-size: 15px; }
	.scope-note { margin: 0; padding: 14px 0; border-bottom: 1px solid var(--line); color: var(--ink-soft); font-size: 14px; line-height: 1.45; }
	.search-error { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 0; color: var(--ink-soft); }
	.search-error p { margin: 0; }
	.search-error button { min-height: var(--hit); padding: 6px 12px; border: 1px solid var(--line-strong); border-radius: 999px; background: transparent; color: var(--accent); font: var(--text-control)/1.4 var(--font-ui); cursor: pointer; }
	.search-error button:hover, .search-error button:focus-visible { border-color: var(--accent); }
	.results-tools { display: flex; align-items: center; gap: 10px; margin-left: auto; }
	.results-tools > span { flex: 0 0 auto; color: var(--ink-faint); white-space: nowrap; }
	ol { margin: 0; padding: 0; list-style: none; }
	.show-all { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 46px; margin-top: 14px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: transparent; color: var(--accent); font: inherit; font-size: 14px; cursor: pointer; transition: border-color .2s ease, background .2s ease; }
	.show-all:hover, .show-all:focus-visible { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 5%, transparent); }
	.show-all:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
	.show-all :global(svg) { transition: transform .2s ease; }
	.show-all.expanded :global(svg) { transform: rotate(180deg); }
	.empty { margin: 0; padding: 18px 0; color: var(--ink-soft); }

	@container (max-width: 520px) {
		.search-field { min-height: 54px; padding: 0 13px; }
		input { font-size: 16px; }
	}

	@container (max-width: 760px) {
		.results-tools { gap: 8px; }
	}
</style>

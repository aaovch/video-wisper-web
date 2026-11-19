<script lang="ts">
	import { SegmentedControl, SegmentedControlItem } from '@ui-sdk/svelte/segmented-control';
	import { Input } from '@ui-sdk/svelte/input';
	import { Button } from '@ui-sdk/svelte/button';
	import WeaponDrawing from './WeaponDrawing.svelte';
	import ArchiveKeyDialog from '$lib/components/ArchiveKeyDialog.svelte';
	import { page } from '$app/state';
	import { accessibleRecordingCount } from '$lib/data/collections';
	let keyDialog = $state<ArchiveKeyDialog>();
	import { communityArchive } from '$lib/site';
	import SearchResultItem from '$lib/components/SearchResultItem.svelte';
	import { searchHitKey as uniqueHitKey } from '$lib/search-hit-key';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createSearchController } from '$lib/search-controller.svelte';
	import { writeSearchState } from '$lib/search-url-state';
	import { hasSearchQuery } from '$lib/search-tokenizer.js';
	import { base } from '$app/paths';
	import ReportCard from './ReportCard.svelte';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import { collectionReportFacets, collectionReportsMatchingFacets } from '$lib/collection-facets';
	import { groupCatalogCollections } from '$lib/catalog-groups';
	import CollectionCard from '$lib/components/CollectionCard.svelte';
	import SearchFilters from './SearchFilters.svelte';
	import SearchFilterChips from './SearchFilterChips.svelte';
	let filterControls = $state<SearchFilters>();
	import { russianPlural } from '$lib/utils';
	import { collections, collectionsForReport, reportGate, type Collection } from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';
	import type { SearchHit } from '$lib/search';
	import {
		selectedFilterCount,
		activeSearchFilters,
		type SearchFilterGroup
	} from '$lib/search-filters';
	import { readRecentReports } from '$lib/recent-reports';
	import { getReportSummary } from '$lib/data/report-meta';
	import {
		catalogReportSlugs,
		discoverableReportSlugs,
		isReportLocked,
		searchableReportSlugs,
		visibleSubset
	} from '$lib/search-visibility';

	let { archived = false }: { archived?: boolean } = $props();
	const catalogCollections = $derived(
		collections.filter(
			(collection) => collection.hema && !collection.catalogHidden && (communityArchive || Boolean(collection.archived) === archived)
		)
	);
	const searchArea = $derived(communityArchive ? 'all' : archived ? 'archive' : 'main');
	const searchAreaLabel = $derived(communityArchive || archived ? 'в архиве' : 'в каталоге');
	const aliases: Record<string, string> = {
		Longsword: 'Длинный меч', 'Sword and Buckler': 'Меч и баклер', 'Petr Vasiliev': 'Пётр Васильев'
	};
	const facetName = (value: string) => aliases[value] ?? value;
	const views = [
		{ value: '', zone: undefined, label: 'Везде' },
		{ value: 'recordings', zone: 'reports', label: 'Записи целиком' },
		{ value: 'chapters', zone: 'chapters', label: 'Главы' },
		{ value: 'theses', zone: 'theses', label: 'Тезисы' },
		{ value: 'transcript', zone: 'transcript', label: 'Расшифровки' },
		{ value: 'additional', zone: 'additional', label: 'Доп. материалы' }
	] as const;
	const view = $derived(views.find(option => option.value === page.url.searchParams.get('view')) ?? views[0]);
	const recordingsOnly = $derived(view.zone === 'reports');
	const controller = createSearchController({
		defaults: { authors: [], places: [], weapons: [], collections: [] },
		normalizeSelections: (values) => ({
			...values, weapons: [...new Set(values.weapons.map(facetName))],
			authors: [...new Set(values.authors.map(facetName))]
		}),
		scopes: () => [{ kind: 'archive', label: searchAreaLabel, reportSlugs: scopeSlugs, zones: view.zone ? [view.zone] : undefined }],
		limit: 30
	});
	const search = controller.state;
	function switchView(value: string) {
		const url = writeSearchState(page.url, search.query, search.selections, false);
		if (value) url.searchParams.set('view', value);
		else url.searchParams.delete('view');
		void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}
	const countLabel = $derived(russianPlural(search.total, recordingsOnly
		? ['запись', 'записи', 'записей']
		: ['совпадение', 'совпадения', 'совпадений']));
	function applyCorrection() {
		if (!search.correctedQuery) return;
		search.query = search.correctedQuery;
		controller.edit();
		inputEl?.focus();
	}
	function clearSearch() { controller.clear(); inputEl?.focus(); }

	let inputEl = $state<HTMLInputElement | null>(null);
	let activeHit = $state(-1);
	$effect(() => { search.query; search.selections; view; activeHit = -1; });

	// «Недавно открывали» живёт только в localStorage — читаем после маунта, чтобы не ломать гидрацию.
	let recentSlugs = $state<string[]>([]);
	onMount(() => {
		recentSlugs = readRecentReports();
	});

	const filterGroups = $derived.by<SearchFilterGroup[]>(() => [
		{
			id: 'weapons',
			label: 'Оружие',
			options: facetOptions('weapons')
		},
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
			id: 'collections',
			label: 'Коллекция',
			options: catalogCollections.map((collection) => ({
				value: collection.slug,
				label: collection.title,
				count: new Set(collection.items).size
			}))
		}
	]);
	const activeFilterCount = $derived(selectedFilterCount(search.selections));

	const matchingSelections = $derived.by(() => {
		const expand = (values: string[]) => [...values, ...Object.keys(aliases).filter(alias => values.includes(aliases[alias]))];
		return { ...search.selections, weapons: expand(search.selections.weapons), authors: expand(search.selections.authors) };
	});
	const filteredCollections = $derived(
		catalogCollections.filter(
			(collection) =>
				collectionReportsMatchingFacets(collection, matchingSelections).length > 0 &&
				(search.selections.collections.length === 0 || search.selections.collections.includes(collection.slug))
		)
	);
	const recordingCounts = $derived(new Map(filteredCollections.map(collection => {
		const items = collectionReportsMatchingFacets(collection, matchingSelections);
		return [collection.slug, accessibleRecordingCount(items, lock.unlocked)] as const;
	})));
	const available = $derived(filteredCollections.filter(c => !c.private || recordingCounts.get(c.slug)));
	const restricted = $derived(filteredCollections.filter(c => c.private && !recordingCounts.get(c.slug)));
	const lockedRecordings = $derived.by(() => {
		const recordings = new Map<string, string>();
		for (const collection of filteredCollections) {
			if (collection.access?.master) continue;
			const matches = collectionReportsMatchingFacets(collection, matchingSelections);
			for (const slug of matches) {
				if (!isReportLocked(slug, lock.unlocked)) continue;
				const pass = collection.access?.passes?.find(pass => pass.items.length === 1 && pass.items[0] === slug);
				if (pass) recordings.set(slug, pass.title ?? getReportSummary(slug)?.title ?? slug);
			}
		}
		return [...recordings];
	});
	const catalog = $derived(groupCatalogCollections(filteredCollections));
	const filtersActive = $derived(activeFilterCount > 0);
	let seminarsExpanded = $state(false);
	let seminarGridWidth = $state(0);
	const seminarsPerRow = $derived(Math.max(1, Math.floor((seminarGridWidth + 22) / 232)));
	const visibleSeminars = $derived(filtersActive || seminarsExpanded ? lockedRecordings : lockedRecordings.slice(0, seminarsPerRow));
	const areaReportSlugs = $derived(communityArchive ? discoverableReportSlugs(lock.unlocked, searchArea) : catalogReportSlugs(searchArea));
	const visibleArchiveSlugs = $derived(searchableReportSlugs(lock.unlocked, searchArea));
	const recentReports = $derived(
		recentSlugs
			.filter((slug) => visibleArchiveSlugs.includes(slug))
			.map((slug) => getReportSummary(slug))
			.filter((summary): summary is NonNullable<typeof summary> => Boolean(summary))
			.slice(0, 2)
	);
	const scopeSlugs = $derived(
		filtersActive
			? visibleSubset(filteredCollections.flatMap((collection) => collectionReportsMatchingFacets(collection, matchingSelections)), areaReportSlugs)
			: areaReportSlugs
	);
	const uniqueHits = $derived.by(() => {
		const seen = new Set<string>();
		return search.hits
			.filter((hit) => {
				// A locked video has one public synopsis result until a key is entered.
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
		return 'Результаты поиска';
	});
	const statusText = $derived(
		search.loading
			? 'Ищем'
			: search.error
				? 'Поиск временно недоступен'
				: hasSearchQuery(search.query)
					? `${search.total} ${countLabel}`
					: ''
	);

	function uniqueFacet(key: 'authors' | 'places' | 'weapons'): string[] {
		return [
			...new Set(
				catalogCollections.flatMap((collection) => collection.facets?.[key] ?? []).filter(Boolean).map(facetName)
			)
		].sort((a, b) => a.localeCompare(b, 'ru'));
	}

	function handleWindowKeydown(event: KeyboardEvent) {
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
		if (search.loading || !visibleHits.length) return;
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
				catalogCollections.flatMap((collection) => collection.items.filter(slug => collectionReportFacets(collection, slug)[key]?.some(raw => facetName(raw) === value)))
			).size
		}));
	}

	function resultIsLocked(hit: SearchHit): boolean {
		return isReportLocked(hit.reportSlug, lock.unlocked);
	}

	function resultCollection(hit: SearchHit): Collection | undefined {
		const memberships = collectionsForReport(hit.reportSlug).filter(
			(collection) => (communityArchive || Boolean(collection.archived) === archived)
		);
		const gatedSlugs = new Set(reportGate(hit.reportSlug).map((target) => target.collectionSlug));
		return memberships.find((collection) => gatedSlugs.has(collection.slug)) ?? memberships[0];
	}

	function resultHref(hit: SearchHit, seek = false): string {
		const [pathname, hash] = hit.href.split('#');
		const params = new URLSearchParams({ q: search.query.trim() });
		if (communityArchive) params.set('archiveSearch', page.url.search.slice(1));
		if (seek && hit.start != null) params.set('t', String(hit.start));
		return `${base}${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
	}

	function openResult(event: MouseEvent, hit: SearchHit, seek: boolean) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		void goto(resultHref(hit, seek));
	}

</script>

<svelte:window onkeydown={handleWindowKeydown} />

	<section class="search-stage" aria-label={communityArchive ? 'Поиск' : undefined} aria-labelledby={communityArchive ? undefined : 'archive-search-title'}>
	<div class="container search-stage-inner" class:compact={communityArchive}>
		{#if !communityArchive}
		<nav class="catalog-navigation" aria-label="Раздел каталога">
			<a href="{base}/" aria-current={!archived ? 'page' : undefined}>Каталог</a>
			<a href="{base}/archive/" aria-current={archived ? 'page' : undefined}>Архив</a>
			<a href="{base}/stats/">Статистика</a>
		</nav>
		{/if}
		<div class="home-intro" class:illustrated={!archived}>
		<div>
		{#if !communityArchive}
		<h1 id="archive-search-title">{archived ? 'Поиск по архиву' : 'Поиск по каталогу'}</h1>
		{/if}
		{#if communityArchive}
			<h2>Найти тему</h2>
		{/if}
		</div>
		{#if !archived}<WeaponDrawing weapon="sabre-and-longsword" />{/if}
		</div>
		</div>
</section>
<div class="container search-dock" class:pinned={hasSearchQuery(search.query)}>
		<div class="search-field" role="search" onpointerenter={controller.preload}>
			<MagnifyingGlass size={30} weight="thin" aria-hidden="true" />
			<Input type="search" aria-label={communityArchive || archived ? 'Поиск по архиву' : 'Поиск по каталогу'} bind:value={() => search.query, (query) => { search.query = query; controller.edit(); }} onfocus={controller.preload} onkeydown={onSearchKeydown} placeholder={communityArchive ? 'Например, шаг-выпад' : 'Например: подготовка атаки'} autocomplete="off" spellcheck="false">
				{#snippet render({ props })}
					<input {...props} bind:this={inputEl} />
				{/snippet}
			</Input>

			<div class="inline-filters">
				<SearchFilters bind:this={filterControls} inline groups={filterGroups} selections={search.selections} onToggle={controller.toggleFilter} onClear={controller.clearFilters} />
			</div>
		</div>
		<p class="sr-only" role="status" aria-live="polite">{statusText}</p>
</div>
{#if activeFilterCount}
	<div class="container selected-filters">
		<SearchFilterChips filters={activeSearchFilters(filterGroups, search.selections)} onRemove={controller.toggleFilter} onEmpty={(groupId) => filterControls?.focusGroup(groupId)} />
		<Button type="button" onclick={() => { controller.clearFilters(); inputEl?.focus({ preventScroll: true }); }}>
			{#snippet render({ props })}
				<button {...props} class="clear-filters">Снять все</button>
			{/snippet}
		</Button>
	</div>
{/if}


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
	<section class="container results" aria-busy={search.loading}>
		<div class="results-layout">
		<div class="results-main">
		<div class="section-title search-results-heading">
			<h2>{resultsHeading}</h2>
			<div class="results-tools">
				{#if search.loading}<span class="label" aria-hidden="true">Ищем…</span>{:else if search.total > 0}<span class="label">{visibleHits.length < search.total ? `${visibleHits.length} из ${search.total}` : search.total}</span>{/if}
			</div>
		</div>
		<SegmentedControl class="zone-picker" aria-label="Где искать" value={view.value} onValueChange={(value) => { if (value != null) switchView(value); }}>
			{#each views as option (option.value)}
				<SegmentedControlItem value={option.value}>{option.label}</SegmentedControlItem>
			{/each}
		</SegmentedControl>
		{#if search.correctedQuery && !search.loading && !search.error}
			<p class="search-note">Возможно, вы имели в виду <Button onclick={applyCorrection}>
				{#snippet render({ props })}
					<button {...props} class="correction">{search.correctedQuery}</button>
				{/snippet}
			</Button>?</p>
		{/if}
		{#if search.error}
			<div class="search-error" role="alert">
				<p>Поиск временно недоступен.</p>
				<Button type="button" onclick={controller.retry}>
					{#snippet render({ props })}
						<button {...props}>Повторить</button>
					{/snippet}
				</Button>
			</div>
		{:else if !search.loading && visibleHits.length === 0}
			<div class="empty"><p>Ничего не найдено. Попробуйте короче или другое название.</p><Button type="button" onclick={clearSearch}>
				{#snippet render({ props })}
					<button {...props}>Очистить поиск</button>
				{/snippet}
			</Button>{#if activeFilterCount > 0}<Button type="button" onclick={controller.clearFilters}>
				{#snippet render({ props })}
					<button {...props}>Сбросить фильтры</button>
				{/snippet}
			</Button>{/if}</div>
		{:else}
			<ol class="result-list" inert={search.loading}>
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
			{#if search.total > 5}
				<Button type="button" aria-expanded={search.expanded} onclick={controller.toggleExpanded}>
					{#snippet render({ props })}
						<button {...props} class="show-all" class:expanded={search.expanded}>
					<span>{search.expanded ? `Свернуть до 5 ${recordingsOnly ? 'записей' : 'совпадений'}` : `Показать ${search.total} ${countLabel}`}</span>
					<CaretDown size={17} weight="bold" aria-hidden="true" />
				</button>
					{/snippet}
				</Button>
			{/if}
		{/if}
		</div>
		</div>
	</section>
{/if}

{#if !communityArchive || !hasSearchQuery(search.query)}
<section class="container catalog" aria-labelledby="collection-title">
	<div class="section-title">
		<h2 id="collection-title">{communityArchive ? 'Коллекции' : hasSearchQuery(search.query) ? 'Все коллекции' : archived ? 'Коллекции архива' : 'Коллекции'}</h2>
	</div>

	{#if filteredCollections.length === 0}
		<p class="empty">{filtersActive ? 'Нет коллекций с таким сочетанием фильтров.' : archived ? 'Архивных коллекций пока нет.' : 'Коллекций пока нет.'}</p>
	{:else if communityArchive}
		<div class="catalog-grid">{#each available as collection (collection.slug)}<CollectionCard {collection} />{/each}</div>
		{#if !available.length}<p class="empty">Для просмотра этих материалов нужен ключ.</p>{/if}
		{#if restricted.length || lockedRecordings.length}
			<div class="restricted">
				{#if restricted.length}
					<h2>Внутренние коллекции</h2>
					<div class="catalog-grid">
						{#each restricted as collection (collection.slug)}
							<CollectionCard {collection} onUnlock={() => keyDialog?.open(collection)} />
						{/each}
					</div>
				{/if}
				{#if lockedRecordings.length}
					<h2 class="group-title" id="individual-seminars">Отдельные семинары и лекции</h2>
					<div class="record-grid" id="seminar-grid" bind:clientWidth={seminarGridWidth}>
						{#each visibleSeminars as [slug, title], index (slug)}
							{@const report = getReportSummary(slug)}
							{@const owners = collectionsForReport(slug)}
							{@const authors = [...new Set(owners.flatMap(c => collectionReportFacets(c, slug).authors ?? []).map(facetName))]}
							{#if report && owners.length}
								<ReportCard report={{...report, title}} index={index + 1} collectionSlug={owners[0].slug} byline={[authors.join(', '), report.duration ? Math.round(report.duration / 60) + ' мин' : ''].filter(Boolean).join(' · ')} />
							{/if}
						{/each}
					</div>
					{#if !filtersActive && lockedRecordings.length > seminarsPerRow}
						<Button aria-controls="seminar-grid" aria-expanded={seminarsExpanded} onclick={() => seminarsExpanded = !seminarsExpanded}>
							{#snippet render({ props })}
								<button {...props} class="more-seminars">{seminarsExpanded ? 'Свернуть' : 'Показать все'} <span>{lockedRecordings.length}</span></button>
							{/snippet}
						</Button>
					{/if}
				{/if}
			</div>
		{/if}
		<ArchiveKeyDialog bind:this={keyDialog} />
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
{/if}

<style>
	:global(.zone-picker) { display: flex; flex-wrap: wrap; gap: 4px 8px; padding: 10px 0; }
	:global(.zone-picker button) { min-height: var(--hit); padding: 4px 12px; font: var(--text-control)/1.4 var(--font-ui); color: var(--ink-soft); border: 1px solid transparent; border-radius: 999px; background: transparent; cursor: pointer; }
	:global(.zone-picker button[aria-checked='true']) { border-color: currentColor; color: var(--accent-ink); }
	:global(.zone-picker button:hover) { text-decoration: underline; }
	.correction { font: inherit; color: var(--accent-ink); text-decoration: underline; background: transparent; border: 0; cursor: pointer; }
	.home-intro.illustrated { display: grid; grid-template-columns: minmax(0, 1fr) clamp(160px, 24vw, 230px); align-items: center; gap: 24px; }
	.home-intro h2 { margin: 0; font: 500 clamp(24px, 2.6vw, 34px)/1.12 var(--font-display); }
	@media (max-width: 600px) {
		.home-intro.illustrated { grid-template-columns: minmax(0, 1fr) 42%; gap: 8px; }
	}
	.restricted { margin-top: clamp(44px, 6vw, 80px); border-top: 1px solid var(--line-strong); padding-top: 28px; }
	.restricted h2 { margin: 0 0 14px; font: 500 clamp(24px, 2.6vw, 34px)/1.12 var(--font-display); }
	.restricted .group-title { margin-top: 32px; }
	.more-seminars { margin: 18px auto 0; display: flex; align-items: center; gap: 8px; padding: 10px 18px; border: 1px solid currentColor; border-radius: 8px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
	.more-seminars span { opacity: .7; font-size: .85em; }
	.record-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr)); gap: 22px; }
	.empty button { min-height: 44px; margin: 8px 12px 0 0; padding: 8px 12px; background: transparent; border: 1px solid var(--line-strong); border-radius: var(--radius); color: var(--accent-ink); font: var(--text-control)/1.4 var(--font-ui); cursor: pointer; }
	.empty button:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
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
		background: var(--paper);
		border-radius: var(--radius);
	}

	h1 {
		font-size: clamp(32px, 5vw, 48px);
		line-height: 1.15;
		margin-bottom: 28px;
	}

	.search-field {
		display: grid;
		grid-template-columns: auto minmax(220px, 1fr) minmax(0, auto);
		align-items: center;
		gap: 16px;
		min-height: 66px;
		padding: 0 20px;
		border: 1px solid var(--ink-faint);
		border-radius: var(--radius);
		background: var(--surface);
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
	.inline-filters { min-width: 0; max-width: 440px; padding-block: 6px; }
	.selected-filters { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; margin-top: 10px; }
	.clear-filters { flex: none; min-height: var(--hit); padding: 0 4px; border: 0; background: transparent; color: var(--ink-soft); font: var(--text-label)/1.4 var(--font-ui); cursor: pointer; }
	.clear-filters:hover { color: var(--accent-ink); }
	.clear-filters:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
	@media (max-width: 960px) {
		.search-field { grid-template-columns: auto minmax(0, 1fr); }
		.inline-filters { grid-column: 1 / -1; max-width: none; border-top: 1px solid var(--line); }
		.search-field > input { min-height: 54px; }
	}


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
	.results[aria-busy='true'] .result-list { min-height: 18rem; opacity: 0.65; }
	.search-note { margin: 0; padding: 13px 0; border-bottom: 1px solid var(--line); color: var(--ink-soft); font-size: 14px; }
	.search-error { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 0; color: var(--ink-soft); }
	.search-error p { margin: 0; }
	.search-error button { min-height: var(--hit); padding: 6px 12px; border: 1px solid var(--line-strong); border-radius: 999px; background: transparent; color: var(--accent); font: var(--text-control)/1.4 var(--font-ui); cursor: pointer; }
	.search-error button:hover, .search-error button:focus-visible { border-color: var(--accent); }

	.section-title {
		display: flex;
		align-items: baseline;
		gap: 18px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--line);
	}

	.section-title h2 {
		font-size: 22px;
		line-height: 1.2;
	}

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
		line-height: 1.15;
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

		.catalog-grid {
			grid-template-columns: minmax(0, 1fr);
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
	.search-stage-inner.compact { padding-block: clamp(16px, 2vw, 24px); }

	.home-intro h1 { margin: 0; }
	.search-field { border-color: var(--edge); }
	.search-dock { position: relative; z-index: 5; background: var(--paper); }
	.search-dock.pinned { position: sticky; top: 0; }
	.search-stage-inner, .search-stage-inner.compact { padding-bottom: clamp(18px, 2vw, 28px); }
	.search-field { row-gap: 0; grid-template-rows: minmax(54px, auto); }
	@media (max-width: 760px) {
		.results { overflow-anchor: none; }

	}
</style>

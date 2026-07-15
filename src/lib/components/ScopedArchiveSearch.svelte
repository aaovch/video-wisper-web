<script lang="ts">
	import { base } from '$app/paths';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import FileText from 'phosphor-svelte/lib/FileText';
	import FunnelSimple from 'phosphor-svelte/lib/FunnelSimple';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import Play from 'phosphor-svelte/lib/Play';
	import SearchFilterChips from '$lib/components/SearchFilterChips.svelte';
	import SearchFilterPanel from '$lib/components/SearchFilterPanel.svelte';
	import { collections, getCollection } from '$lib/data/collections';
	import { getReportSummary } from '$lib/data/report-meta';
	import { preloadSearchIndex, searchReport, searchReports, type SearchHit } from '$lib/search';
	import {
		activeSearchFilters,
		selectedFilterCount,
		type SearchFilterGroup,
		type SearchFilterSelections
	} from '$lib/search-filters';
	import { highlightParts } from '$lib/text-highlight';
	import { formatTime } from '$lib/utils';

	let {
		kind,
		reportSlug = '',
		reportSlugs = [],
		collectionSlug = '',
		onHit
	}: {
		kind: 'collection' | 'report';
		reportSlug?: string;
		reportSlugs?: string[];
		collectionSlug?: string;
		onHit?: (hit: SearchHit, seek: boolean, href: string) => void;
	} = $props();

	let query = $state('');
	let debouncedQuery = $state('');
	let hits = $state<SearchHit[]>([]);
	let selections = $state<SearchFilterSelections>({ zones: [], sections: [], authors: [], places: [], weapons: [] });
	let filterSheetOpen = $state(false);
	let showAllHits = $state(false);
	let loading = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let indexRequested = false;
	let filterReturnFocus: HTMLButtonElement | null = null;

	const label = $derived(kind === 'report' ? 'Поиск в отчёте' : 'Поиск в коллекции');
	const placeholder = $derived(`${label}…`);
	const scopedCollection = $derived(kind === 'collection' ? getCollection(collectionSlug) : undefined);
	const reportFacetMap = $derived.by(() => buildReportFacetMap(reportSlugs, collectionSlug));
	const filterGroups = $derived.by<SearchFilterGroup[]>(() =>
		kind === 'report' ? reportFilterGroups(hits, selections) : collectionFilterGroups()
	);
	const activeFilters = $derived(activeSearchFilters(filterGroups, selections));
	const activeFilterCount = $derived(selectedFilterCount(selections));
	const hasFilterGroups = $derived(
		filterGroups.some(
			(group) =>
				group.options.length > 1 ||
				group.options.some((option) => selections[group.id]?.includes(option.value))
		)
	);
	const filteredHits = $derived(hits.filter(hitMatchesFilters));
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
	const visibleHits = $derived(showAllHits ? uniqueHits : uniqueHits.slice(0, 5));

	function normalize(value: string): string {
		return value.toLocaleLowerCase('ru').replace(/ё/g, 'е');
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
		}
	}

	function matchCountLabel(count: number): string {
		const mod100 = count % 100;
		if (mod100 >= 11 && mod100 <= 14) return 'совпадений';
		const mod10 = count % 10;
		if (mod10 === 1) return 'совпадение';
		if (mod10 >= 2 && mod10 <= 4) return 'совпадения';
		return 'совпадений';
	}

	function buildReportFacetMap(slugs: string[], activeCollectionSlug: string) {
		const map = new Map<string, Record<'authors' | 'places' | 'weapons', Set<string>>>();
		for (const slug of slugs) {
			const summary = getReportSummary(slug);
			const haystack = normalize([summary?.title, summary?.subtitle, ...(summary?.tags ?? [])].filter(Boolean).join(' '));
			const values = { authors: new Set<string>(), places: new Set<string>(), weapons: new Set<string>() };
			for (const membership of collections.filter((collection) => collection.items.includes(slug))) {
				for (const key of ['authors', 'places', 'weapons'] as const) {
					const facetValues = membership.facets?.[key] ?? [];
					for (const value of facetValues) {
						if (
							membership.slug !== activeCollectionSlug ||
							facetValues.length === 1 ||
							haystack.includes(normalize(value))
						) values[key].add(value);
					}
				}
			}
			map.set(slug, values);
		}
		return map;
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
				label: 'Раздел',
				options: scopedCollection.sections.map((section) => ({
					value: section.title,
					label: section.title,
					count: section.items.length
				}))
			});
		}
		for (const [id, groupLabel] of [
			['authors', 'Автор'],
			['places', 'Место'],
			['weapons', 'Оружие']
		] as const) groups.push({ id, label: groupLabel, options: facetOptions(id) });
		return groups;
	}

	const zoneLabels = {
		chapters: 'Главы',
		theses: 'Тезисы',
		transcript: 'Расшифровка',
		additional: 'Дополнительные материалы'
	} as const;

	function reportFilterGroups(results: SearchHit[], current: SearchFilterSelections): SearchFilterGroup[] {
		const selectedZones = current.zones ?? [];
		const options = Object.entries(zoneLabels)
			.map(([value, optionLabel]) => ({
				value,
				label: optionLabel,
				count: results.filter((hit) => hit.zone === value).length
			}))
			.filter((option) => option.count > 0 || selectedZones.includes(option.value));
		return options.length ? [{ id: 'zones', label: 'Зона поиска', options }] : [];
	}

	function hitMatchesFilters(hit: SearchHit): boolean {
		if (selections.zones.length > 0 && !selections.zones.includes(hit.zone)) return false;
		if (kind !== 'collection') return true;

		if (selections.sections.length > 0) {
			const matchesSection = scopedCollection?.sections?.some(
				(section) => selections.sections.includes(section.title) && section.items.includes(hit.reportSlug)
			);
			if (!matchesSection) return false;
		}

		const facets = reportFacetMap.get(hit.reportSlug);
		for (const key of ['authors', 'places', 'weapons'] as const) {
			const selected = selections[key] ?? [];
			if (selected.length > 0 && !selected.some((value) => facets?.[key].has(value))) return false;
		}
		return true;
	}

	function toggleFilter(groupId: string, value: string) {
		showAllHits = false;
		const current = selections[groupId] ?? [];
		selections = {
			...selections,
			[groupId]: current.includes(value)
				? current.filter((item) => item !== value)
				: [...current, value]
		};
	}

	function clearFilters() {
		showAllHits = false;
		selections = { zones: [], sections: [], authors: [], places: [], weapons: [] };
	}

	function requestIndex() {
		if (indexRequested) return;
		indexRequested = true;
		preloadSearchIndex();
	}

	function scheduleSearch() {
		requestIndex();
		clearTimeout(timer);
		showAllHits = false;
		const normalized = query.trim();
		if (normalized.length < 2) {
			debouncedQuery = '';
			hits = [];
			loading = false;
			return;
		}
		loading = true;
		timer = setTimeout(() => {
			debouncedQuery = query.trim();
		}, 180);
	}

	$effect(() => {
		const q = debouncedQuery.trim();
		if (q.length < 2) return;
		let cancelled = false;
		const search =
			kind === 'report' && reportSlug
				? searchReport(reportSlug, q, 120)
				: searchReports(q, 120, reportSlugs);
		void search.then((results) => {
			if (!cancelled && q === debouncedQuery.trim()) {
				hits = results;
				loading = false;
			}
		});
		return () => {
			cancelled = true;
		};
	});

	function resultHref(hit: SearchHit, seek = false): string {
		const [pathname, hash] = hit.href.split('#');
		const params = new URLSearchParams({ q: query.trim() });
		if (collectionSlug) params.set('from', collectionSlug);
		if (seek && hit.start != null) params.set('t', String(Math.ceil(hit.start)));
		return `${base}${pathname}?${params.toString()}${hash ? `#${hash}` : ''}`;
	}

	function openCurrentReport(event: MouseEvent, hit: SearchHit, seek: boolean) {
		if (kind !== 'report' || hit.reportSlug !== reportSlug || !onHit) return;
		event.preventDefault();
		onHit(hit, seek, resultHref(hit, seek));
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<section class="scope-search" aria-label={label}>
	<label class="search-field">
		<MagnifyingGlass size={25} weight="thin" aria-hidden="true" />
		<span class="sr-only">{label}</span>
		<input
			type="search"
			bind:value={query}
			onfocus={requestIndex}
			oninput={scheduleSearch}
			{placeholder}
			autocomplete="off"
			spellcheck="false"
		/>
		{#if loading}<span class="loading label" aria-live="polite">ищем</span>{/if}
	</label>

	{#if activeFilters.length > 0 || (hasFilterGroups && query.trim().length < 2)}
		<div class="filter-controls">
			{#if hasFilterGroups && query.trim().length < 2}
				<button
					type="button"
					class="filter-trigger"
					aria-expanded={filterSheetOpen}
					onclick={openFilters}
				>
					<FunnelSimple size={18} weight="regular" aria-hidden="true" />
					<span>Фильтры</span>
					{#if activeFilterCount > 0}<span class="filter-badge mono">{activeFilterCount}</span>{/if}
				</button>
			{/if}
			<SearchFilterChips filters={activeFilters} onRemove={toggleFilter} />
		</div>
	{/if}

	{#if filterSheetOpen && hasFilterGroups}
		<button class="filter-backdrop" type="button" aria-label="Закрыть фильтры" onclick={closeFilters}></button>
		<div class="filter-sheet" role="dialog" aria-modal="true" aria-label="Фильтры поиска">
			<SearchFilterPanel
				groups={filterGroups}
				{selections}
				onToggle={toggleFilter}
				onClear={clearFilters}
				onClose={closeFilters}
			/>
		</div>
	{/if}

	{#if query.trim().length >= 2}
		<div class="results" aria-live="polite">
			<div class="results-layout">
				<div class="results-main">
					<div class="results-head">
						<p>{kind === 'report' ? 'Совпадения в отчёте' : 'Совпадения в коллекции'}</p>
						<div class="results-tools">
							<span class="label">{visibleHits.length} из {uniqueHits.length}</span>
							{#if hasFilterGroups}
								<button
									type="button"
									class="filter-trigger filter-trigger--compact"
									aria-expanded={filterSheetOpen}
									onclick={openFilters}
								>
									<FunnelSimple size={16} weight="regular" aria-hidden="true" />
									<span>Фильтры</span>
									{#if activeFilterCount > 0}<span class="filter-badge mono">{activeFilterCount}</span>{/if}
								</button>
							{/if}
						</div>
					</div>
			{#if !loading && visibleHits.length === 0}
				<p class="empty">Ничего не найдено.</p>
			{:else}
				<ol>
					{#each visibleHits as hit (uniqueHitKey(hit))}
						<li>
							<div class="result-copy">
								<p class="breadcrumb">{hit.reportTitle} <span>›</span> {hit.title}</p>
								<h3>{hit.title}</h3>
								{#if hit.matchReason?.length}
									<p class="match-reason"><span>{hit.matchReasonKind === 'tag' ? 'Метка отчёта' : 'Связано по смыслу'}</span> {hit.matchReason.join(' · ')}</p>
								{/if}
								<p class="snippet">
									{#each highlightParts(hit.snippet, query) as part}
										{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}
									{/each}
								</p>
							</div>
							<div class="actions">
								<a href={resultHref(hit)} onclick={(event) => openCurrentReport(event, hit, false)}>
									<FileText size={19} weight="thin" /> {hit.kind === 'report' ? 'Открыть отчёт' : 'Открыть блок'} <ArrowRight size={18} weight="thin" />
								</a>
								{#if hit.start != null}
									<a href={resultHref(hit, true)} onclick={(event) => openCurrentReport(event, hit, true)}>
										<Play size={19} weight="thin" /> Смотреть с {formatTime(hit.start)} <ArrowRight size={18} weight="thin" />
									</a>
								{/if}
							</div>
						</li>
					{/each}
				</ol>
				{#if uniqueHits.length > 5}
					<button
						type="button"
						class="show-all"
						class:expanded={showAllHits}
						aria-expanded={showAllHits}
						onclick={() => (showAllHits = !showAllHits)}
					>
						<span>{showAllHits ? 'Свернуть до 5 совпадений' : `Показать все ${uniqueHits.length} ${matchCountLabel(uniqueHits.length)}`}</span>
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
	.filter-backdrop { position: fixed; inset: 0; z-index: 80; width: 100%; height: 100%; border: 0; background: color-mix(in srgb, var(--ink) 28%, transparent); cursor: default; }
	.filter-sheet { position: fixed; z-index: 81; top: 0; right: 0; width: min(390px, calc(100vw - 28px)); height: 100dvh; overflow-y: auto; padding: 28px; border-left: 1px solid var(--line-strong); background: var(--paper); box-shadow: -18px 0 40px color-mix(in srgb, var(--ink) 12%, transparent); }
	.results { margin-top: 20px; }
	.results-layout { display: block; }
	.results-main { min-width: 0; border-top: 1px solid var(--line-strong); }
	.results-head { display: flex; align-items: baseline; gap: 16px; padding: 13px 0; border-bottom: 1px solid var(--line); }
	.results-head p { margin: 0; font-size: 15px; }
	.results-tools { display: flex; align-items: center; gap: 10px; margin-left: auto; }
	.results-tools > span { flex: 0 0 auto; color: var(--ink-faint); white-space: nowrap; }
	ol { margin: 0; padding: 0; list-style: none; }
	li { display: grid; grid-template-columns: minmax(0, 1fr) minmax(150px, 23%); gap: clamp(18px, 3vw, 34px); padding: 18px 0; border-bottom: 1px solid var(--line-strong); }
	.breadcrumb { margin: 0 0 7px; color: var(--accent); font-size: 13px; }
	.breadcrumb span { padding: 0 4px; color: var(--ink-faint); }
	h3 { margin: 0 0 7px; font-size: clamp(21px, 2.3vw, 28px); font-weight: 500; line-height: 1.1; }
	.snippet { margin: 0; color: var(--ink-soft); font-size: 15px; line-height: 1.48; }
	.match-reason { display: flex; flex-wrap: wrap; gap: 5px 9px; margin: 0 0 7px; color: var(--ink-faint); font-size: 12px; line-height: 1.35; }
	.match-reason span { color: var(--accent); font-family: var(--font-ui); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
	mark { background: color-mix(in srgb, var(--accent) 13%, var(--paper)); color: var(--accent-ink); font-weight: 600; }
	.actions { display: flex; flex-direction: column; gap: 7px; padding-left: 16px; border-left: 1px solid var(--line-strong); }
	.actions a { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 7px; min-height: 44px; padding: 5px 0; color: var(--accent); font-size: 14px; }
	.show-all { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 46px; margin-top: 14px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: transparent; color: var(--accent); font: inherit; font-size: 14px; cursor: pointer; transition: border-color .2s ease, background .2s ease; }
	.show-all:hover, .show-all:focus-visible { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 5%, transparent); }
	.show-all:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
	.show-all :global(svg) { transition: transform .2s ease; }
	.show-all.expanded :global(svg) { transform: rotate(180deg); }
	.empty { margin: 0; padding: 18px 0; color: var(--ink-soft); }

	@container (max-width: 560px) {
		.search-field { min-height: 54px; padding: 0 13px; }
		input { font-size: 16px; }
		.filter-controls { align-items: flex-start; flex-direction: column; }
		li { grid-template-columns: 1fr; gap: 14px; }
		.actions { flex-direction: row; flex-wrap: wrap; padding: 10px 0 0; border-top: 1px solid var(--line); border-left: 0; }
	}

	@container (max-width: 760px) {
		.results-tools { gap: 8px; }
	}

	@media (max-width: 760px) {
		.filter-sheet {
			top: auto;
			bottom: 0;
			width: 100%;
			height: auto;
			max-height: 84dvh;
			padding: 22px 20px 28px;
			border-top: 1px solid var(--line-strong);
			border-left: 0;
			border-radius: 16px 16px 0 0;
			box-shadow: 0 -18px 40px color-mix(in srgb, var(--ink) 12%, transparent);
		}
	}
</style>

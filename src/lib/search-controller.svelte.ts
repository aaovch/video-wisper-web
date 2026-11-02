import { beforeNavigate, afterNavigate, goto } from '$app/navigation';
import { page } from '$app/state';
import { tick, untrack } from 'svelte';
import { readSearchState, writeSearchState } from './search-url-state';
import { hasSearchQuery } from './search-tokenizer.js';
import { preloadSearchIndex, searchScoped, whenSearchComplete } from './search';
import type { SearchHit, SearchScope, SearchResultKind } from './search-types';
import type { SearchFilterSelections } from './search-filters';

/** Shared URL, request and dialog state for catalog, collection and report search. */
export function createSearchController(options: {
	defaults: SearchFilterSelections;
	scopes: () => SearchScope[];
	limit: number;
	preserveHashScroll?: () => boolean;
}) {
	const state = $state({
		query: '', selections: structuredClone(options.defaults), expanded: false,
		hits: [] as SearchHit[], scope: undefined as SearchScope | undefined,
		loading: false, error: false, matchKind: 'empty' as SearchResultKind,
		correctedQuery: undefined as string | undefined, fallback: false, scopeLabel: '',
		filterOpen: false
	});
	let retryNonce = $state(0);
	let restoreScroll = $state<number | null>(null);
	let filterTrigger: HTMLElement | null = null;
	const scrollKey = () => `search-scroll:${page.url.pathname}${page.url.search}${page.url.hash}`;

	beforeNavigate(() => {
		try { sessionStorage.setItem(scrollKey(), String(window.scrollY)); } catch { /* optional storage */ }
	});
	afterNavigate(({ type }) => {
		if (type !== 'popstate' || options.preserveHashScroll?.()) return;
		try {
			const stored = sessionStorage.getItem(scrollKey());
			const value = stored === null ? NaN : Number(stored);
			restoreScroll = Number.isFinite(value) ? value : null;
		} catch { restoreScroll = null; }
	});
	$effect(() => {
		const url = page.url;
		untrack(() => {
			const next = readSearchState(url, options.defaults);
			state.query = next.query;
			if (JSON.stringify(next.selections) !== JSON.stringify(state.selections)) state.selections = next.selections;
			state.expanded = next.expanded;
		});
	});
	$effect(() => {
		const query = state.query.trim();
		const scopes = options.scopes();
		retryNonce;
		let cancelled = false;
		state.error = false;
		state.hits = [];
		state.correctedQuery = undefined;
		state.matchKind = 'empty';
		state.fallback = false;
		state.scopeLabel = '';
		state.scope = undefined;
		state.loading = hasSearchQuery(query);
		if (!hasSearchQuery(query)) return;
		async function run() {
			try {
				const response = await searchScoped(query, scopes, options.limit);
				if (cancelled) return;
				state.hits = response.hits;
				state.scope = response.resultScope;
				state.matchKind = response.matchKind;
				state.correctedQuery = response.correctedQuery;
				state.fallback = response.fallback;
				state.scopeLabel = response.resultScope.label;
				state.loading = false;
				if (response.pending) {
					await whenSearchComplete();
					if (!cancelled) await run();
				}
			} catch {
				if (!cancelled) { state.hits = []; state.error = true; state.loading = false; }
			}
		}
		const timer = setTimeout(() => void run(), 180);
		return () => { cancelled = true; clearTimeout(timer); };
	});
	$effect(() => {
		if (state.loading || restoreScroll === null) return;
		const y = restoreScroll;
		restoreScroll = null;
		void tick().then(() => window.scrollTo(0, y));
	});
	const save = () => {
		const url = writeSearchState(page.url, state.query, state.selections, state.expanded);
		if (url.href !== page.url.href) void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	};
	return {
		state, save,
		edit: () => { state.expanded = false; save(); },
		clear: () => { state.query = ''; state.expanded = false; save(); },
		toggleFilter: (id: string, value: string) => {
			const current = state.selections[id] ?? [];
			state.selections = { ...state.selections, [id]: current.includes(value) ? current.filter(v => v !== value) : [...current, value] };
			state.expanded = false; save();
		},
		clearFilters: () => { state.selections = structuredClone(options.defaults); state.expanded = false; save(); },
		retry: () => { retryNonce += 1; },
		preload: preloadSearchIndex,
		openFilters: (event: MouseEvent) => { filterTrigger = event.currentTarget as HTMLElement; state.filterOpen = true; },
		closeFilters: () => { state.filterOpen = false; queueMicrotask(() => filterTrigger?.focus()); }
	};
}

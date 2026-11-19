<script lang="ts">
	import { communityArchive } from '$lib/site';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import FileText from 'phosphor-svelte/lib/FileText';
	import LockKey from 'phosphor-svelte/lib/LockKey';
	import Play from 'phosphor-svelte/lib/Play';
	import SearchMatchNote from '$lib/components/SearchMatchNote.svelte';
	import SearchSourceLinks from '$lib/components/SearchSourceLinks.svelte';
	import { highlightParts } from '$lib/text-highlight';
	import { formatTime } from '$lib/utils';
	import type { SearchHit, SearchScope } from '$lib/search-types';

	let {
		hit,
		query,
		scope,
		layout = 'scoped',
		showReportTitle = true,
		locked = false,
		lockedCollectionTitle = '',
		active = false,
		language = 'ru',
		id,
		hrefFor,
		onOpen
	}: {
		hit: SearchHit;
		query: string;
		scope?: SearchScope;
		layout?: 'archive' | 'scoped' | 'report';
		showReportTitle?: boolean;
		locked?: boolean;
		lockedCollectionTitle?: string;
		active?: boolean;
		language?: 'ru' | 'en';
		id?: string;
		hrefFor: (hit: SearchHit, seek?: boolean) => string;
		onOpen: (event: MouseEvent, hit: SearchHit, seek: boolean) => void;
	} = $props();
</script>

<li {id} class:active class:locked class:report-layout={layout === 'report'}>
	<div class="copy">
		{#if locked}
			<p class="breadcrumb locked-label"><LockKey size={16} weight="regular" aria-hidden="true" /> {language === 'en' ? 'Full video requires a key' : 'Полное видео по ключу'}{#if lockedCollectionTitle} · {lockedCollectionTitle}{/if}</p>
			<h3><a href={hrefFor(hit)} onclick={(event) => onOpen(event, hit, false)}>{hit.reportTitle}</a></h3>
			<p class="snippet locked-copy">{#each highlightParts(hit.snippet, query) as part}{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</p>
		{:else}
			{#if showReportTitle && hit.reportTitle !== hit.title}<p class="breadcrumb">{hit.reportTitle}</p>{/if}
			{#snippet title()}{#each highlightParts(hit.title, query) as part}{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}{/snippet}
			<h3>{#if communityArchive && layout === 'archive'}<a href={hrefFor(hit)} aria-label={hit.title} onclick={(event) => onOpen(event, hit, false)}>{@render title()}</a>{:else}{@render title()}{/if}</h3>
			<SearchMatchNote {hit} {query} {language} />
			<p class="snippet">
				{#each highlightParts(hit.snippet, query) as part}
					{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}
				{/each}
			</p>
			<SearchSourceLinks {hit} {scope} {language} />
		{/if}
	</div>
	<div class="actions">
		{#if locked}
			<a href={hrefFor(hit, hit.start != null)} onclick={(event) => onOpen(event, hit, hit.start != null)}>
				<LockKey size={21} weight="thin" aria-hidden="true" />
				<span>{language === 'en' ? 'Read public synopsis' : 'Читать краткий пересказ'}</span>
				<ArrowRight size={20} weight="thin" />
			</a>
		{:else}
			{#if hit.start != null}
				<a class="watch" href={hrefFor(hit, true)} onclick={(event) => onOpen(event, hit, true)}>
					<Play size={17} aria-hidden="true" /> {language === 'en' ? 'Watch from' : 'Смотреть с'} {formatTime(hit.start)}
				</a>
			{/if}
			<a href={hrefFor(hit)} onclick={(event) => onOpen(event, hit, false)}>
				<FileText size={17} aria-hidden="true" />
				{language === 'en' ? (hit.kind === 'report' ? 'Open report' : 'Read chapter') : (hit.kind === 'report' ? 'Открыть отчёт' : 'Читать разбор')}
			</a>
		{/if}
	</div>
</li>

<style>
	li { padding: 24px 0; border-bottom: 1px solid var(--line); }
	li.active { outline: 2px solid var(--focus); outline-offset: 4px; }

	.breadcrumb { margin: 0 0 6px; color: var(--ink-soft); font: 14px/1.45 var(--font-ui); }
	.locked-label, .actions, .actions a { display: flex; align-items: center; gap: 8px; }
	h3 { margin: 0 0 8px; font-size: clamp(21px, 2vw, 24px); line-height: 1.2; }
	h3 a { color: inherit; }
	h3 a:hover { text-decoration: underline; }
	.snippet { max-width: var(--measure); margin: 0; color: var(--ink-soft); font-size: 18px; line-height: 1.5; }
	mark { color: var(--mark-ink); background: var(--mark); }
	.actions { flex-wrap: wrap; gap: 8px 20px; margin-top: 12px; }
	.actions a { min-height: var(--hit); font: var(--text-control)/1.4 var(--font-ui); text-underline-offset: 3px; }
	.actions a:hover { text-decoration: underline; }
	.actions .watch { color: var(--accent-ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
</style>

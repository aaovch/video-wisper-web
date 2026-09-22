<script lang="ts">
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
			<p class="breadcrumb locked-label"><LockKey size={16} weight="regular" aria-hidden="true" /> {language === 'en' ? 'Password-protected video' : 'Видео по паролю'}{#if lockedCollectionTitle} · {lockedCollectionTitle}{/if}</p>
			<h3>{hit.reportTitle}</h3>
			<p class="snippet locked-copy">{language === 'en' ? 'A match was found in protected material. The excerpt and exact position will appear after you enter the password.' : 'Совпадение найдено внутри закрытого материала. Фрагмент и точное место откроются после ввода пароля.'}</p>
		{:else}
			{#if showReportTitle}<p class="breadcrumb">{hit.reportTitle}</p>{/if}
			<h3>{#each highlightParts(hit.title, query) as part}{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</h3>
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
				<span>{language === 'en' ? 'Enter password and open' : 'Ввести пароль и открыть'}</span>
				<ArrowRight size={20} weight="thin" />
			</a>
		{:else}
			<a href={hrefFor(hit)} onclick={(event) => onOpen(event, hit, false)}>
				<FileText size={19} weight="thin" />
				<span>{language === 'en' ? (hit.kind === 'report' ? 'Open report' : 'Open chapter') : (hit.kind === 'report' ? 'Открыть отчёт' : 'Открыть блок')}</span>
				<ArrowRight size={18} weight="thin" />
			</a>
			{#if hit.start != null}
				<a href={hrefFor(hit, true)} onclick={(event) => onOpen(event, hit, true)}>
					<Play size={19} weight="thin" />
					<span>{language === 'en' ? 'Watch from' : 'Смотреть с'} {formatTime(hit.start)}</span>
					<ArrowRight size={18} weight="thin" />
				</a>
			{/if}
		{/if}
	</div>
</li>

<style>
	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(150px, 23%);
		gap: clamp(18px, 3vw, 34px);
		padding: 18px 0;
		border-bottom: 1px solid var(--line-strong);
	}
	li.active { margin-inline: -12px; padding-inline: 12px; background: color-mix(in srgb, var(--accent) 7%, transparent); }
	li.locked { background: color-mix(in srgb, var(--paper-2) 74%, transparent); }
	li.report-layout { grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 22px 0; }
	.breadcrumb { margin: 0 0 7px; color: var(--accent); font-size: 13px; }
	.locked-label { display: flex; align-items: center; gap: 7px; color: var(--ink-faint); }
	h3 { margin: 0 0 8px; font-size: clamp(19px, 2vw, 24px); line-height: 1.12; }
	.snippet { margin: 0; color: var(--ink-soft); font-size: 15px; line-height: 1.48; }
	.locked-copy { max-width: 68ch; }
	mark { background: color-mix(in srgb, var(--accent) 13%, var(--paper)); color: var(--accent-ink); font-weight: 600; }
	.actions { display: flex; flex-direction: column; gap: 7px; padding-left: 16px; border-left: 1px solid var(--line-strong); }
	.actions a { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 7px; min-height: 44px; padding: 5px 0; color: var(--accent); font-size: 14px; }
	.actions a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
	.report-layout .actions { flex-direction: row; flex-wrap: wrap; gap: 8px 28px; padding: 0; border: 0; }
	.report-layout .actions a span { white-space: nowrap; }

	@media (max-width: 760px) {
		li { grid-template-columns: 1fr; gap: 14px; }
		.actions { flex-direction: row; flex-wrap: wrap; padding: 10px 0 0; border-top: 1px solid var(--line); border-left: 0; }
	}
</style>

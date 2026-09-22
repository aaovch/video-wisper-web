<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, afterNavigate } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import Check from 'phosphor-svelte/lib/Check';
	import Clock from 'phosphor-svelte/lib/Clock';
	import CopySimple from 'phosphor-svelte/lib/CopySimple';
	import FilmStrip from 'phosphor-svelte/lib/FilmStrip';
	import Play from 'phosphor-svelte/lib/Play';
	import ChapterCard from '$lib/components/ChapterCard.svelte';
	import ChapterNav from '$lib/components/ChapterNav.svelte';
	import ReportStudyMaterials from '$lib/components/ReportStudyMaterials.svelte';
	import TranscriptReader from '$lib/components/TranscriptReader.svelte';
	import ScopedArchiveSearch from '$lib/components/ScopedArchiveSearch.svelte';
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';
	import Lock from '$lib/components/Lock.svelte';
	import VisitCounter from '$lib/components/VisitCounter.svelte';
	import { copyText } from '$lib/clipboard';
	import { reveal } from '$lib/attachments';
	import { collectionsForReport, reportGate } from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';
	import { SITE_NAME } from '$lib/site';
	import { formatDuration, formatTime } from '$lib/utils';
	import { highlightParts } from '$lib/text-highlight';
	import { fragmentAnchor, reportSearchFragments } from '$lib/search-fragments';
	import { getReportMaterials } from '$lib/report-materials';
	import { tick } from 'svelte';
	import type { SearchHit } from '$lib/search';
	import type { TranscriptChapter } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const report = $derived(data.report);
	const gate = $derived(reportGate(report.slug));
	const reportCollections = $derived(collectionsForReport(report.slug));
	const language = $derived(reportCollections.some((collection) => collection.language === 'en') ? 'en' : 'ru');
	const locked = $derived(gate.length > 0 && !gate.some((target) => lock.isUnlocked(target)));
	let highlightQuery = $state('');
	let searchHits = $state<SearchHit[]>([]);
	let searchBusy = $state(false);
	let selectedSearchAnchor = $state('');
	let initialSearchAnchor = '';
	afterNavigate(({ from, to, type }) => {
		if (!from || from.url.pathname !== to?.url.pathname) initialSearchAnchor = page.url.hash.slice(1);
		else if (type === 'popstate' && page.url.hash && highlightQuery) {
			const anchor = page.url.hash.slice(1);
			void tick().then(() => requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' })));
		}
	});
	function updateSearchResults(hits: SearchHit[], busy: boolean) {
		searchHits = hits;
		searchBusy = busy;
		if (!busy && hits.length && initialSearchAnchor) {
			const anchor = initialSearchAnchor;
			initialSearchAnchor = '';
			void tick().then(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
		}
	}

	const searchFragments = $derived(reportSearchFragments(searchHits, report.slug));
	const searchFragmentIndex = $derived(searchFragments.findIndex(hit => fragmentAnchor(hit) === selectedSearchAnchor));
	let searchContextEl = $state<HTMLDivElement | null>(null);
	$effect(() => {
		if (!browser || !searchContextEl) return;
		const node = searchContextEl;
		const update = () => node.closest<HTMLElement>('.report')?.style.setProperty('--search-context-height', `${node.offsetHeight}px`);
		const observer = new ResizeObserver(update);
		observer.observe(node); update();
		return () => { observer.disconnect(); node.closest<HTMLElement>('.report')?.style.removeProperty('--search-context-height'); };
	});
	function stepSearchFragment(direction: number) {
		const next = searchFragments[searchFragmentIndex + direction];
		if (!next) return;
		const url = new URL(page.url);
		url.hash = fragmentAnchor(next);
		url.searchParams.delete('t');
		onSearchHit(next, false, url.href);
	}

	let requestedCollectionSlug = $state('');
	const returnCollection = $derived(
		reportCollections.find((collection) => collection.slug === requestedCollectionSlug) ?? reportCollections[0]
	);
	const otherCollections = $derived(reportCollections.filter((collection) => collection.slug !== returnCollection?.slug));

	let seekTo = $state(0);
	let layoutEl = $state<HTMLElement | null>(null);
	let playerEl = $state<HTMLElement | null>(null);
	let playerComp = $state<{ seekAndPlay?: (t: number) => void } | null>(null);
	let appliedUrlSeek = $state('');

	$effect(() => {
		if (!browser) return;
		highlightQuery = page.url.searchParams.get('q') ?? '';
		selectedSearchAnchor = page.url.hash.slice(1);
		requestedCollectionSlug = page.url.searchParams.get('from') ?? '';
	});

	// Высота sticky-плеера → отступ для «Содержания», чтобы строки не наслаивались при прокрутке.
	$effect(() => {
		if (!browser || !playerEl || !layoutEl) return;
		const mq = window.matchMedia('(max-width: 960px)');
		const stickyPlayback = playbackStarted;
		const sync = () => {
			if (!layoutEl) return;
			if (!mq.matches || !stickyPlayback) {
				layoutEl.style.removeProperty('--mobile-sticky-h');
				return;
			}
			layoutEl.style.setProperty('--mobile-sticky-h', `${playerEl!.offsetHeight + 8}px`);
		};
		sync();
		const ro = new ResizeObserver(sync);
		ro.observe(playerEl);
		mq.addEventListener('change', sync);
		return () => {
			ro.disconnect();
			mq.removeEventListener('change', sync);
		};
	});

	// --- Подсветка блока по позиции воспроизведения ---
	let activeChapterIndex = $state(-1);
	let videoPlaying = $state(false);
	let videoTime = $state(0);
	let playbackStarted = $state(false);
	let scrollIndex = $state(0);
	let additionalOpen = $state(false);
	let overviewExpanded = $state(false);
	$effect(() => { if (highlightQuery && selectedSearchAnchor === 'overview-title') overviewExpanded = true; });
	let activeFocusTab = $state('');

	const hasTranscript = $derived(Boolean(report.has_transcript));
	let transcriptChapters = $state<TranscriptChapter[]>([]);
	let chapterTranscriptLoadState = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let chapterTranscriptPromise: Promise<TranscriptChapter[]> | null = null;
	let openChapterTranscriptIndex = $state<number | null>(null);
	let transcriptReturnTarget: HTMLButtonElement | null = null;
	let readerInitialTime = $state(0);
	let readerAutoplay = $state(false);

	function ensureTranscriptChapters(): Promise<TranscriptChapter[]> {
		if (!browser || !hasTranscript) return Promise.resolve([]);
		if (chapterTranscriptPromise) return chapterTranscriptPromise;
		chapterTranscriptLoadState = 'loading';
		chapterTranscriptPromise = fetch(`${base}/transcripts/${report.slug}.chapters.json`)
			.then((response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.json();
			})
			.then((data: { chapters?: TranscriptChapter[] }) => {
				transcriptChapters = Array.isArray(data.chapters) ? data.chapters : [];
				chapterTranscriptLoadState = 'ready';
				return transcriptChapters;
			})
			.catch((error) => {
				chapterTranscriptPromise = null;
				chapterTranscriptLoadState = 'error';
				throw error;
			});
		return chapterTranscriptPromise;
	}

	function openTranscriptReader(
		index: number,
		trigger?: HTMLButtonElement | null,
		start?: number,
		shouldPlay?: boolean
	) {
		if (!report.chapters[index]) return;
		transcriptReturnTarget = trigger ?? document.querySelector<HTMLButtonElement>(`#chapter-transcript-trigger-${index + 1}`);
		const continuesCurrentPlayback = playbackStarted && activeChapterIndex === index;
		readerInitialTime = start ?? (continuesCurrentPlayback ? videoTime : report.chapters[index].start);
		readerAutoplay = shouldPlay ?? (continuesCurrentPlayback && videoPlaying);
		videoPlaying = readerAutoplay;
		seekTo = readerInitialTime;
		videoTime = readerInitialTime;
		activeChapterIndex = index;
		openChapterTranscriptIndex = index;
		void ensureTranscriptChapters().catch(() => {});
	}

	function closeTranscriptReader() {
		const returnTarget = transcriptReturnTarget;
		seekTo = videoTime;
		openChapterTranscriptIndex = null;
		void tick().then(() => requestAnimationFrame(() => returnTarget?.focus()));
	}

	function showNextTranscriptChapter() {
		if (openChapterTranscriptIndex === null) return;
		const nextIndex = openChapterTranscriptIndex + 1;
		if (!report.chapters[nextIndex]) return;
		openTranscriptReader(nextIndex, undefined, report.chapters[nextIndex].start, videoPlaying);
	}

	function seekFromTranscript(start: number) {
		seekTo = start;
		videoTime = start;
		activeChapterIndex = chapterIndexAt(start);
		playbackStarted = true;
	}

	// --- Копирование тезиса цитатой ---
	let copiedQuote = $state('');
	let quoteResetTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyQuote(text: string) {
		const quote = language === 'en' ? `“${text}” — ${report.title}` : `«${text}» — ${report.title}`;
		const copied = await copyText(quote);
		if (!copied) return;
		copiedQuote = text;
		clearTimeout(quoteResetTimer);
		quoteResetTimer = setTimeout(() => (copiedQuote = ''), 1800);
	}

	const reportMaterials = $derived(getReportMaterials(report));
	const reportExercises = $derived(reportMaterials.exercises);
	const reportFocusTabs = $derived(report.focus_tabs ?? []);
	const hasStudyMaterials = $derived(
		reportMaterials.notes.length > 0 ||
			reportMaterials.visuals.length > 0 ||
			reportMaterials.glossary.length > 0
	);
	const hasAdditional = $derived(
		reportFocusTabs.length > 0 ||
			reportExercises.length > 0 ||
			hasStudyMaterials ||
			hasTranscript
	);

	$effect(() => {
		if (!reportFocusTabs.length) {
			activeFocusTab = '';
			return;
		}
		if (!reportFocusTabs.some((tab) => tab.id === activeFocusTab)) {
			activeFocusTab = reportFocusTabs[0].id;
		}
	});

	function onVideoTime(t: number) {
		videoTime = t;
		if (!playbackStarted && t > 0.3) playbackStarted = true;
		const idx = chapterIndexAt(t);
		if (idx !== activeChapterIndex) activeChapterIndex = idx;
		if (openChapterTranscriptIndex !== null && videoPlaying && idx !== openChapterTranscriptIndex) {
			openChapterTranscriptIndex = idx;
		}
	}

	function chapterIndexAt(t: number): number {
		const ch = report.chapters;
		let idx = 0;
		for (let i = 0; i < ch.length; i++) {
			if (ch[i].start <= t + 0.25) idx = i;
			else break;
		}
		return idx;
	}

	// Ссылки из глобального поиска могут сразу открыть нужный блок и таймкод.
	$effect(() => {
		if (!browser || !report.video || !playerComp) return;
		const raw = page.url.searchParams.get('t') ?? '';
		if (!raw || raw === appliedUrlSeek) return;
		const target = Number(raw);
		if (!Number.isFinite(target) || target < 0) return;
		appliedUrlSeek = raw;
		seekTo = target;
		activeChapterIndex = chapterIndexAt(target);
		playbackStarted = true;
		setTimeout(() => playerComp?.seekAndPlay?.(target), 0);
	});

	// Прямая ссылка на дополнительные материалы должна раскрывать свернутый блок.
	$effect(() => {
		if (browser && page.url.hash === '#additional-title') additionalOpen = true;
	});

	// Блок на позиции плеера: держится и на паузе (пока воспроизведение хоть раз начиналось).
	const playingIndex = $derived(playbackStarted ? activeChapterIndex : -1);
	// Активный пункт в «Содержании»: воспроизведение приоритетнее скролла.
	const navActive = $derived(playingIndex >= 0 ? playingIndex : scrollIndex);

	// Скролл-спай: какой блок сейчас в зоне чтения (когда видео не играет).
	$effect(() => {
		const ids = report.chapters.map((_, i) => `ch-${i + 1}`);
		const nodes = ids
			.map((id) => document.getElementById(id))
			.filter((n): n is HTMLElement => Boolean(n));
		if (!nodes.length || typeof IntersectionObserver === 'undefined') return;

		const visible = new Set<number>();
		let scrollTimer: ReturnType<typeof setTimeout> | undefined;
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const idx = Number((entry.target as HTMLElement).dataset.idx);
					if (entry.isIntersecting) visible.add(idx);
					else visible.delete(idx);
				}
				clearTimeout(scrollTimer);
				scrollTimer = setTimeout(() => {
					if (visible.size) scrollIndex = Math.min(...visible);
				}, 120);
			},
			{ rootMargin: '-18% 0px -72% 0px', threshold: 0 }
		);

		nodes.forEach((n, i) => {
			n.dataset.idx = String(i);
			io.observe(n);
		});

		return () => {
			clearTimeout(scrollTimer);
			io.disconnect();
		};
	});

	function seekVideo(start: number) {
		seekTo = start;
		activeChapterIndex = chapterIndexAt(start);
		playbackStarted = true;
		// Синхронно, внутри жеста — иначе на мобильных play() блокируется.
		playerComp?.seekAndPlay?.(start);
		if (window.matchMedia('(max-width: 960px)').matches) {
			playerEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function selectChapter(index: number, start: number) {
		seekVideo(start);
		document.getElementById(`ch-${index + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	async function onSearchHit(hit: SearchHit, seek: boolean, href: string) {
		await goto(href, { noScroll: true, keepFocus: true });
		selectedSearchAnchor = fragmentAnchor(hit);
		if (hit.chapterIndex != null) {
			if (hit.kind === 'transcript' && hasTranscript) {
				const target = Math.ceil(hit.start ?? report.chapters[hit.chapterIndex].start);
				openTranscriptReader(hit.chapterIndex, undefined, target, seek);
				return;
			}
			void tick().then(() => {
				const target = document.getElementById(selectedSearchAnchor);
				if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
			});
			const target = seek
				? Math.ceil(hit.start ?? report.chapters[hit.chapterIndex].start)
				: hit.start ?? report.chapters[hit.chapterIndex].start;
			if (seek) seekVideo(target);
			document.getElementById(`ch-${hit.chapterIndex + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			return;
		}
		void tick().then(() => {
			const target = document.getElementById(selectedSearchAnchor);
			if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
		});
		if (hit.zone === 'additional') {
			additionalOpen = true;
			requestAnimationFrame(() => {
				document.getElementById('additional-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
			return;
		}
		if (hit.zone === 'theses') {
			document.getElementById('overview-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			return;
		}
		document.querySelector('.report-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>{report.title} — {SITE_NAME}</title>
	<meta name="description" content={report.subtitle} />
	<meta property="og:type" content="article" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={report.title} />
	<meta property="og:description" content={report.subtitle} />
	<meta name="twitter:card" content="summary" />
</svelte:head>

{#if locked}
		<Lock
			targets={gate}
			title={report.title}
			subtitle={language === 'en' ? 'Enter the collection password or an access key for this material.' : 'Введите пароль коллекции или ключ доступа к этому материалу.'}
		/>
{:else}
<article class="report container">
	<header class="report-head reveal" {@attach reveal()}>
		<nav class="breadcrumbs" aria-label={language === 'en' ? 'Breadcrumbs' : 'Хлебные крошки'}>
			{#if !returnCollection?.isolated}
				<a href="{base}/{returnCollection?.archived ? 'archive/' : ''}">{language === 'en' ? (returnCollection?.archived ? 'Archive' : 'Catalog') : (returnCollection?.archived ? 'Архив' : 'Каталог')}</a><span aria-hidden="true">/</span>
			{/if}
			{#if returnCollection}
				<a href="{base}/collections/{returnCollection.slug}/">{returnCollection.title}</a><span aria-hidden="true">/</span>
			{/if}
			<span>{report.title}</span>
		</nav>
		<p class="eyebrow label">{language === 'en' ? 'Report' : 'Отчёт'}</p>
		<h1>{report.title}</h1>
		<p class="subtitle">{report.subtitle}</p>
		<div class="report-meta">
			<span><Clock size={18} /> {formatDuration(report.duration, language)}</span>
			<span><FilmStrip size={18} /> {report.chapters.length} {language === 'en' ? 'semantic chapters' : 'смысловых блоков'}</span>
			<span class="views"><VisitCounter target={{ kind: 'report', slug: report.slug }} suffix={language === 'en' ? 'visits' : 'посещений'} /></span>
		</div>
		{#if otherCollections.length && !returnCollection?.isolated}
			<p class="memberships label">{language === 'en' ? 'Also in collections:' : 'Также в коллекциях:'}
				{#each otherCollections as collection, i (collection.slug)}
					<a href="{base}/collections/{collection.slug}/">{collection.title}</a>{i < otherCollections.length - 1 ? ', ' : ''}
				{/each}
			</p>
		{/if}
	</header>

	{#if highlightQuery.trim()}
		<div bind:this={searchContextEl} class="search-context" aria-label={language === 'en' ? 'Active search' : 'Активный поиск'}>
			<span class="search-query">{language === 'en' ? 'Search:' : 'Поиск:'} <strong>{highlightQuery}</strong></span>
			<div class="fragment-navigation" role="group" aria-label={language === 'en' ? 'Search match navigation' : 'Навигация по найденным фрагментам'}>
				<button type="button" aria-label={language === 'en' ? 'Previous match' : 'Предыдущий фрагмент'} disabled={searchBusy || searchFragmentIndex <= 0} onclick={() => stepSearchFragment(-1)}>{language === 'en' ? 'Previous' : 'Предыдущий'}</button>
				<span role="status" aria-live="polite">{language === 'en' ? (searchBusy ? 'Searching…' : searchFragmentIndex >= 0 ? `Match ${searchFragmentIndex + 1} of ${searchFragments.length}` : `Matches: ${searchFragments.length}`) : (searchBusy ? 'Ищем…' : searchFragmentIndex >= 0 ? `Фрагмент ${searchFragmentIndex + 1} из ${searchFragments.length}` : `Фрагментов: ${searchFragments.length}`)}</span>
				<button type="button" aria-label={language === 'en' ? 'Next match' : 'Следующий фрагмент'} disabled={searchBusy || !searchFragments.length || searchFragmentIndex >= searchFragments.length - 1} onclick={() => stepSearchFragment(1)}>{language === 'en' ? 'Next' : 'Следующий'}</button>
			</div>
			<button type="button" onclick={() => { document.getElementById('report-search')?.scrollIntoView({ block: 'start' }); document.querySelector<HTMLInputElement>('#report-search input')?.focus({ preventScroll: true }); }}>{language === 'en' ? 'View results' : 'К результатам'}</button>
			<button type="button" onclick={() => { const url = new URL(page.url); url.searchParams.delete('q'); url.searchParams.delete('results'); void goto(url, { replaceState: true, noScroll: true, keepFocus: true }); }}>{language === 'en' ? 'Remove highlight' : 'Убрать подсветку'}</button>
		</div>
	{/if}

	<div class="layout" class:no-video={!report.video} bind:this={layoutEl}>
		<aside class="rail">
			{#if report.video && openChapterTranscriptIndex === null}
				<div class="video-pin" class:playback-started={playbackStarted} bind:this={playerEl}>
					<VideoPlayer
						bind:this={playerComp}
						video={report.video}
						sourceUrl={report.source_url}
						{seekTo}
						autoplay={videoPlaying}
						onTime={onVideoTime}
						onPlaying={(p) => {
							videoPlaying = p;
							if (p) playbackStarted = true;
						}}
						{language}
					/>
					<p class="video-hint label">{language === 'en' ? 'Chapter timecodes seek the video' : 'Таймкод в блоке перематывает видео'}</p>
				</div>
			{/if}
			<div class="nav-scroll">
				<ChapterNav chapters={report.chapters} onSelect={selectChapter} active={navActive} {language} />
			</div>
		</aside>

		<div class="content">
			<div class="scoped-search-wrap reveal" {@attach reveal()}>
				<ScopedArchiveSearch
					kind="report"
					reportSlug={report.slug}
					reportSlugs={returnCollection?.items ?? [report.slug]}
					collectionSlug={returnCollection?.slug ?? ''}
					{language}
					onHit={onSearchHit}
					onResults={updateSearchResults}
				/>
			</div>

			<div class="top-sections">
			{#snippet thesisItem(thesis: string)}
				<li>
					<span class="thesis-text">{#each highlightParts(thesis, highlightQuery) as part}{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</span>
					<button
						type="button"
						class="copy-quote"
						class:copied={copiedQuote === thesis}
						onclick={() => copyQuote(thesis)}
						aria-label={language === 'en' ? (copiedQuote === thesis ? 'Key point copied' : 'Copy key point as a quote') : (copiedQuote === thesis ? 'Тезис скопирован' : 'Скопировать тезис цитатой')}
						title={language === 'en' ? (copiedQuote === thesis ? 'Copied' : 'Copy as quote') : (copiedQuote === thesis ? 'Скопировано' : 'Скопировать цитатой')}
					>
						{#if copiedQuote === thesis}<Check size={14} weight="bold" />{:else}<CopySimple size={14} />{/if}
					</button>
				</li>
			{/snippet}

			<section class:current-search-fragment={Boolean(highlightQuery) && selectedSearchAnchor === 'overview-title'} class="overview reveal" aria-labelledby="overview-title" {@attach reveal()}>
				<div class="section-heading section-heading--plain"><h2 id="overview-title">{language === 'en' ? 'Overview' : 'Главное'}</h2></div>
				<ul>
					{#each report.overview_theses.slice(0, 3) as thesis (thesis)}{@render thesisItem(thesis)}{/each}
				</ul>
				{#if report.overview_theses.length > 3}
					<details class="more-theses" bind:open={overviewExpanded}>
						<summary>{language === 'en' ? 'All key points' : 'Все тезисы'} <CaretDown size={16} /></summary>
						<ul>{#each report.overview_theses.slice(3) as thesis (thesis)}{@render thesisItem(thesis)}{/each}</ul>
					</details>
				{/if}
				{#if report.long_summary}
					<div class="long-summary">
						{#each report.long_summary.split(/\n\s*\n/) as paragraph (paragraph)}
							<p>{paragraph}</p>
						{/each}
					</div>
				{/if}
				<span class="sr-only" role="status" aria-live="polite">{copiedQuote ? (language === 'en' ? 'Key point copied' : 'Тезис скопирован') : ''}</span>
			</section>

			{#if hasAdditional}
				<section class:current-search-fragment={Boolean(highlightQuery) && selectedSearchAnchor === 'additional-title'} class="additional" aria-labelledby="additional-title">
					<details class="additional-disclosure" bind:open={additionalOpen}>
						<summary id="additional-title" class="additional-summary">
							<span class="additional-title" role="heading" aria-level="2">{language === 'en' ? 'Lecture Materials' : 'Материалы лекции'}</span>
							<span class="additional-summary-action">
								<span>{language === 'en' ? (additionalOpen ? 'Collapse' : 'Expand') : (additionalOpen ? 'Свернуть' : 'Раскрыть')}</span>
								<CaretDown size={18} aria-hidden="true" />
							</span>
						</summary>
						<div class="additional-content">

			{#if reportFocusTabs.length > 0}
				<section class="focus-section reveal extra-block" aria-label={language === 'en' ? 'Topic views' : 'Тематические срезы'} {@attach reveal()}>
					<h3 class="extra-title">{language === 'en' ? 'Topic Views' : 'Тематические срезы'}</h3>
					<div class="focus-tablist" role="tablist">
						{#each reportFocusTabs as tab (tab.id)}
							<button
								type="button"
								class:active={activeFocusTab === tab.id}
								role="tab"
								aria-selected={activeFocusTab === tab.id}
								aria-controls={`focus-${tab.id}`}
								id={`focus-tab-${tab.id}`}
								onclick={() => (activeFocusTab = tab.id)}
							>
								{tab.title}
							</button>
						{/each}
					</div>

					{#each reportFocusTabs as tab (tab.id)}
						{#if activeFocusTab === tab.id}
							<div
								class="focus-panel"
								id={`focus-${tab.id}`}
								role="tabpanel"
								aria-labelledby={`focus-tab-${tab.id}`}
							>
								{#if tab.intro?.length}
									<div class="focus-intro">
										{#each tab.intro as item}
											<p>{item}</p>
										{/each}
									</div>
								{/if}
								<div class="focus-items">
									{#each tab.items as item (item.start)}
										<article class="focus-item">
											<header>
												{#if report.video}
													<button
														type="button"
														class="focus-time"
														onclick={() => seekVideo(item.start)}
												title={language === 'en' ? 'Watch from this point' : 'Смотреть с этого момента'}
												>
													<Play size={11} weight="fill" aria-hidden="true" />
														<span class="mono">{formatTime(item.start)}</span>
													</button>
												{:else}
													<span class="focus-time focus-time-static mono">{formatTime(item.start)}</span>
												{/if}
												<h2>{item.title}</h2>
											</header>
											<p>{item.summary}</p>
											{#if item.theses.length}
												<ul>
													{#each item.theses as thesis}
														<li>{thesis}</li>
													{/each}
												</ul>
											{/if}
										</article>
									{/each}
								</div>
							</div>
						{/if}
					{/each}
				</section>
			{/if}

			{#if reportExercises.length > 0}
				<section class="seminar-exercises-section reveal extra-block" aria-label={language === 'en' ? 'Seminar exercises' : 'Упражнения семинара'} {@attach reveal()}>
					<details class="seminar-exercises">
						<summary><span>{language === 'en' ? 'Exercises' : 'Упражнения'}</span><CaretDown size={17} /></summary>
						<div class="seminar-exercises-body">
							{#each reportExercises as exerciseSection (exerciseSection.title)}
								<section class="seminar-exercise-block">
									<h2>{exerciseSection.title}</h2>
									<ul>
										{#each exerciseSection.items as exercise}
											<li>
												{#if report.video}
													<button
														type="button"
														class="exercise-time"
														onclick={() => seekVideo(exercise.start)}
												title={language === 'en' ? 'Watch exercise from this point' : 'Смотреть упражнение с этого момента'}
													>
												<Play size={11} weight="fill" aria-hidden="true" />
														<span class="mono">{formatTime(exercise.start)}</span>
													</button>
												{:else}
													<span class="exercise-time-static mono">{formatTime(exercise.start)}</span>
												{/if}
												<span>{exercise.text}</span>
											</li>
										{/each}
									</ul>
								</section>
							{/each}
						</div>
					</details>
				</section>
			{/if}

			{#if hasStudyMaterials || hasTranscript}
				<ReportStudyMaterials slug={report.slug} materials={reportMaterials} {hasTranscript} {language} />
			{/if}
						</div>
					</details>
				</section>
			{/if}
			</div>

			<section class="chapters" aria-labelledby="chapters-title">
				<div class="section-heading section-heading--plain"><h2 id="chapters-title">{language === 'en' ? 'Semantic Chapters' : 'Смысловые блоки'}</h2></div>
				{#each report.chapters as chapter, i (chapter.start)}
					<div class="reveal" {@attach reveal()}>
						<ChapterCard
							{chapter}
							index={i}
							onSeek={report.video ? seekVideo : undefined}
							playing={playingIndex === i}
							live={videoPlaying && playingIndex === i}
							highlight={highlightQuery}
							searchSelected={Boolean(highlightQuery) && selectedSearchAnchor === `ch-${i + 1}`}
							transcriptAvailable={hasTranscript}
							onOpenTranscript={(trigger) => openTranscriptReader(i, trigger)}
							{language}
						/>
					</div>
				{/each}
			</section>

			<p class="source label">{report.source_name}</p>
		</div>
	</div>
</article>
	{#if openChapterTranscriptIndex !== null}
		<TranscriptReader
			chapter={report.chapters[openChapterTranscriptIndex]}
			chapterIndex={openChapterTranscriptIndex}
			chapterCount={report.chapters.length}
			transcriptChapter={transcriptChapters[openChapterTranscriptIndex]}
			video={report.video}
			sourceUrl={report.source_url}
			initialTime={readerInitialTime}
			autoplay={readerAutoplay}
			loadState={chapterTranscriptLoadState}
			highlight={highlightQuery}
			{language}
			onClose={closeTranscriptReader}
			onNext={openChapterTranscriptIndex < report.chapters.length - 1 ? showNextTranscriptChapter : undefined}
			onRetry={() => ensureTranscriptChapters().catch(() => {})}
			onSeek={report.video ? seekFromTranscript : undefined}
			onTime={onVideoTime}
			onPlaying={(playing) => {
				videoPlaying = playing;
				if (playing) playbackStarted = true;
			}}
		/>
	{/if}
{/if}

<style>
	.current-search-fragment { outline: 2px solid var(--accent); outline-offset: 8px; }
	:global(#report-search), :global(#overview-title), :global(#additional-title) { scroll-margin-top: calc(var(--search-context-height, 150px) + 20px); }
	.fragment-navigation { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
	.fragment-navigation span { min-width: 130px; text-align: center; font-family: var(--font-ui); font-size: 12px; }
	.search-context .search-query { flex: 1 1 180px; }
	.search-context button:disabled { opacity: .45; cursor: default; }
	@media (max-width: 760px) {
		.search-context { gap: 6px !important; padding: 8px !important; }
		.search-context .search-query { flex-basis: 100%; padding-right: 44px; min-height: 44px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
		.fragment-navigation { width: 100%; justify-content: space-between; gap: 4px; }
		.fragment-navigation span { min-width: 0; font-size: 11px; }
		.search-context button { font-size: 12px !important; padding: 6px !important; }
	}
	@media (max-height: 500px) { .search-context { position: static !important; } .report { --search-context-height: 0px !important; } }

	mark { background: color-mix(in srgb, var(--accent) 13%, var(--paper)); color: var(--accent-ink); font-weight: 600; }
	.search-context { position: sticky; top: 0; z-index: 30; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 20px; padding: 8px 0; background: var(--paper); border-top: 1px solid var(--line-strong); border-bottom: 1px solid var(--line-strong); font-size: 14px; }
	.search-context span { overflow-wrap: anywhere; min-width: 0; }
	.search-context button { min-height: 44px; padding: 6px 10px; color: var(--accent-ink); background: transparent; border: 1px solid var(--line-strong); border-radius: var(--radius); font: inherit; cursor: pointer; }
	.search-context > button { border-color: transparent; }
	.search-context button:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 8%, var(--paper)); }
	.search-context button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
	.report {
		padding-top: clamp(24px, 4vw, 52px);
		padding-bottom: 64px;
		max-width: 1320px;
	}

	.report-head { padding-bottom: 14px; }
	.breadcrumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; color: var(--ink-faint); font-size: 14px; }
	.breadcrumbs a { color: var(--accent); }
	.eyebrow { margin: 0 0 8px; color: var(--accent); }

	.layout {
		display: grid;
		grid-template-columns: minmax(300px, 36%) minmax(0, 1fr);
		gap: clamp(32px, 4vw, 56px);
		align-items: start;
		margin-top: 38px;
	}

	.layout.no-video {
		grid-template-columns: minmax(240px, 28%) minmax(0, 1fr);
	}

	.rail {
		position: sticky;
		top: calc(var(--search-context-height, 0px) + 12px);
		align-self: start;
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-height: calc(100vh - var(--search-context-height, 0px) - 24px);
		min-height: 0;
	}

	.video-pin {
		flex-shrink: 0;
		scroll-margin-top: calc(var(--search-context-height, 0px) + 12px);
	}

	.nav-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		display: flex;
		flex-direction: column;
		gap: 12px;
		/* Тонкий скроллбар «под бумагу» */
		scrollbar-width: thin;
		scrollbar-color: var(--line-strong) transparent;
	}

	.nav-scroll::-webkit-scrollbar {
		width: 8px;
	}

	.nav-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.nav-scroll::-webkit-scrollbar-thumb {
		background: var(--line-strong);
		border-radius: 999px;
		border: 2px solid var(--paper);
	}

	.nav-scroll::-webkit-scrollbar-thumb:hover {
		background: var(--ink-faint);
	}

	.video-hint {
		margin: 8px 0 0;
		text-align: center;
		font-size: 10px;
	}

	.report-head h1 {
		font-size: clamp(38px, 5vw, 66px);
		font-weight: 500;
		margin: 0 0 14px;
		max-width: 18ch;
		line-height: 1;
	}

	.subtitle {
		font-size: clamp(18px, 1.8vw, 22px);
		color: var(--ink-soft);
		max-width: 64ch;
		margin: 0;
		line-height: 1.55;
	}

	.report-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 24px; margin-top: 22px; color: var(--ink-soft); font-size: 14px; }
	.report-meta > span { display: inline-flex; align-items: center; gap: 7px; }
	.report-meta .views { color: var(--ink-faint); }
	.memberships { margin: 14px 0 0; color: var(--ink-faint); }
	.memberships a { color: var(--accent); text-transform: none; letter-spacing: 0; }

	.overview { max-width: 920px; padding: 0 0 4px; }
	.top-sections {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: clamp(34px, 4vw, 48px);
		align-items: start;
		margin-top: 40px;
	}
	.top-sections > .overview,
	.top-sections > .additional { min-width: 0; max-width: 920px; }
	.top-sections .section-heading h2 { font-size: clamp(27px, 2.8vw, 36px); }
	.section-heading { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 12px; align-items: baseline; }
	.section-heading--plain { grid-template-columns: minmax(0, 1fr); }
	.section-heading h2 { margin: 0; font-size: clamp(28px, 3vw, 39px); font-weight: 500; line-height: 1.1; }
	.overview > ul, .more-theses ul { display: grid; gap: 10px; margin: 20px 0 0 54px; padding: 0; list-style: none; }
	.overview li { position: relative; padding-left: 20px; font-size: 17px; line-height: 1.55; }
	.overview li::before { content: ''; position: absolute; left: 1px; top: 0.72em; width: 9px; height: 1px; background: var(--accent); }

	/* Копирование тезиса: кнопка проявляется на hover/фокусе, на тач-экранах видна всегда */
	.copy-quote {
		display: inline-grid;
		place-items: center;
		width: 26px;
		height: 26px;
		margin-left: 8px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--ink-faint);
		vertical-align: middle;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
	}

	.overview li:hover .copy-quote,
	.copy-quote:focus-visible,
	.copy-quote.copied {
		opacity: 1;
	}

	.copy-quote:hover { color: var(--accent); background: var(--paper-2); }
	.copy-quote.copied { color: var(--accent); }

	@media (hover: none) {
		.copy-quote { opacity: 0.55; }
	}
	.more-theses { margin: 14px 0 0 54px; }
	.more-theses summary { display: inline-flex; align-items: center; gap: 7px; color: var(--accent); cursor: pointer; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; list-style: none; }
	.more-theses summary::-webkit-details-marker { display: none; }
	.more-theses summary :global(svg) { transition: transform 0.2s ease; }
	.more-theses[open] summary :global(svg) { transform: rotate(180deg); }
	.more-theses ul { margin-left: 0; }
	.long-summary { max-width: var(--measure); margin: 24px 0 0 54px; color: var(--ink-soft); }
	.long-summary p:last-child { margin-bottom: 0; }

	.seminar-exercises {
		border: 0;
	}

	.seminar-exercises summary {
		cursor: pointer;
		min-height: 50px;
		margin: 0 -12px;
		padding: 13px 12px;
		border-radius: 8px;
		list-style: none;
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 17px;
		transition:
			background-color 0.18s ease,
			color 0.18s ease;
	}

	.seminar-exercises summary:hover,
	.seminar-exercises[open] summary {
		background: color-mix(in srgb, var(--paper-2) 58%, transparent);
	}

	.seminar-exercises summary > :global(svg) { margin-left: auto; color: var(--accent); transition: transform 0.2s ease; }
	.seminar-exercises[open] summary > :global(svg) { transform: rotate(180deg); }

	.seminar-exercises summary::-webkit-details-marker {
		display: none;
	}

	.chapters { margin-top: 56px; }

	.chapters > .section-heading { margin-bottom: 10px; }
	.chapters > .section-heading + .reveal :global(.chapter) { border-top: 0; }
	.additional { margin-top: 0; }
	.additional-disclosure { border: 0; }
	.additional-summary {
		min-height: 58px;
		padding: 8px 0 12px;
		list-style: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		cursor: pointer;
	}
	.additional-summary::-webkit-details-marker { display: none; }
	.additional-summary:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 5px;
		border-radius: 4px;
	}
	.additional-title {
		font-size: clamp(27px, 2.8vw, 36px);
		font-weight: 500;
		line-height: 1.1;
	}
	.additional-summary-action {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--accent);
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.additional-summary-action :global(svg) { transition: transform 0.2s ease; }
	.additional-disclosure[open] .additional-summary-action :global(svg) { transform: rotate(180deg); }
	.additional-content { padding-top: 2px; }
	.extra-block { margin-top: 0; }
	.extra-block + .extra-block { margin-top: 2px; }
	.extra-title { margin: 0 0 14px; font-size: 20px; font-weight: 500; }

	.focus-section {
		margin-top: 0;
		border-top: 1px solid var(--line-strong);
		border-bottom: 1px solid var(--line);
		padding: 18px 0 24px;
	}

	.focus-tablist {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 18px;
	}

	.focus-tablist button {
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		padding: 6px 14px;
		background: transparent;
		color: var(--ink-soft);
		font: inherit;
		font-size: 13px;
		cursor: pointer;
		transition:
			color 0.2s ease,
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.focus-tablist button:hover,
	.focus-tablist button.active {
		color: var(--paper);
		background: var(--accent);
		border-color: var(--accent);
	}

	.focus-panel {
		max-width: var(--measure);
	}

	.focus-intro {
		display: grid;
		gap: 8px;
		margin-bottom: 18px;
		color: var(--ink-soft);
		font-size: 16px;
		line-height: 1.6;
	}

	.focus-intro p {
		margin: 0;
	}

	.focus-items {
		display: grid;
		gap: 18px;
	}

	.focus-item {
		padding-top: 18px;
		border-top: 1px solid var(--line);
	}

	.focus-item header {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: baseline;
		gap: 10px;
		margin-bottom: 8px;
	}

	.focus-item h2 {
		margin: 0;
		color: var(--ink);
		font-size: 20px;
		line-height: 1.25;
	}

	.focus-item p {
		margin: 0 0 10px;
		color: var(--ink-soft);
		font-size: 16px;
		line-height: 1.6;
	}

	.focus-item ul {
		display: grid;
		gap: 6px;
		margin: 0;
		padding-left: 20px;
		color: var(--ink-soft);
		font-size: 15px;
		line-height: 1.55;
	}

	.focus-item li::marker {
		color: var(--accent);
	}

	.focus-time {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		width: max-content;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		padding: 3px 9px;
		color: var(--ink-soft);
		background: transparent;
		font-size: 11px;
		line-height: 1.35;
		cursor: pointer;
		transition:
			color 0.2s ease,
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.focus-time:hover {
		color: var(--paper);
		background: var(--accent);
		border-color: var(--accent);
	}

	.focus-time :global(svg) {
		color: var(--accent);
		transition: color 0.2s ease;
	}

	.focus-time:hover :global(svg) {
		color: var(--paper);
	}

	.focus-time-static {
		cursor: default;
	}

	.seminar-exercises-section {
		margin-top: 0;
	}

	.seminar-exercises {
		border-top: 0;
	}

	.seminar-exercises-body {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px 24px;
		max-width: var(--measure);
		padding: 2px 0 26px;
	}

	.seminar-exercise-block h2 {
		margin: 0 0 8px;
		color: var(--ink);
		font-size: 17px;
		line-height: 1.3;
	}

	.seminar-exercise-block ul {
		display: grid;
		gap: 6px;
		margin: 0;
		padding-left: 0;
		list-style: none;
		color: var(--ink-soft);
		font-size: 15px;
		line-height: 1.55;
	}

	.seminar-exercise-block li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: baseline;
		gap: 9px;
	}

	.exercise-time,
	.exercise-time-static {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		width: max-content;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		padding: 2px 8px;
		font-size: 11px;
		line-height: 1.35;
		color: var(--ink-soft);
		background: transparent;
	}

	.exercise-time {
		cursor: pointer;
		transition:
			color 0.2s ease,
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.exercise-time:hover {
		color: var(--paper);
		background: var(--accent);
		border-color: var(--accent);
	}

	.exercise-time :global(svg) {
		color: var(--accent);
		transition: color 0.2s ease;
	}

	.exercise-time:hover :global(svg) {
		color: var(--paper);
	}

	.source {
		margin: 32px 0 0;
		color: var(--ink-faint);
		word-break: break-all;
	}

	@media (max-width: 960px) {
		.top-sections { grid-template-columns: minmax(0, 1fr); }
		.report { padding-top: 22px; }
		.report-head { padding-bottom: 24px; }
		/* справа плавает кнопка темы — не пускаем под неё текст крошек */
		.breadcrumbs { padding-right: 52px; }
		.layout { margin-top: 28px; }
		.chapters { margin-top: 32px; }
		.layout,
		.layout.no-video {
			grid-template-columns: 1fr;
			gap: 24px;
		}

		.rail {
			display: contents;
			max-height: none;
		}

		.nav-scroll {
			overflow: visible;
			max-height: none;
		}

		.video-pin {
			position: static;
			background: var(--paper);
			padding-bottom: 4px;
		}

		.video-pin.playback-started {
			position: sticky;
			top: calc(var(--search-context-height, 0px) + 8px);
			z-index: 5;
			box-shadow: 0 10px 0 var(--paper);
		}

		.chapters :global(.chapter),
		#overview-title,
		#additional-title {
			scroll-margin-top: calc(var(--search-context-height, 0px) + var(--mobile-sticky-h, 0px) + 16px);
		}

		.video-hint {
			display: none;
		}

		.report-head h1 {
			max-width: none;
		}

		.seminar-exercises-body {
			grid-template-columns: 1fr;
			gap: 16px;
		}
	}

	@media (max-width: 520px) {
		.report-meta { display: grid; gap: 9px; }
		.additional-summary { gap: 12px; }
		.additional-summary-action > span { display: none; }
		.section-heading { grid-template-columns: 30px minmax(0, 1fr); gap: 8px; }
		.overview > ul, .more-theses ul { margin-left: 38px; }
		.more-theses { margin-left: 38px; }
		.long-summary { margin-left: 38px; }
		.focus-item header { grid-template-columns: 1fr; }
	}
</style>

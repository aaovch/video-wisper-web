<script lang="ts">
	import { browser } from '$app/environment';
	import ChapterCard from '$lib/components/ChapterCard.svelte';
	import ChapterNav from '$lib/components/ChapterNav.svelte';
	import ReportSearch from '$lib/components/ReportSearch.svelte';
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';
	import Lock from '$lib/components/Lock.svelte';
	import VisitCounter from '$lib/components/VisitCounter.svelte';
	import { reveal } from '$lib/attachments';
	import { reportGate } from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';
	import { SITE_NAME } from '$lib/site';
	import type { SearchHit } from '$lib/search';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const report = $derived(data.report);
	const gate = $derived(reportGate(report.slug));
	const locked = $derived(gate.length > 0 && !gate.some((c) => lock.isUnlocked(c.slug)));

	let seekTo = $state(0);
	let railEl = $state<HTMLElement | null>(null);
	let playerEl = $state<HTMLElement | null>(null);
	let playerComp = $state<{ seekAndPlay?: (t: number) => void } | null>(null);

	// Высота sticky-плеера → отступ для «Содержания», чтобы строки не наслаивались при прокрутке.
	$effect(() => {
		if (!browser || !playerEl || !railEl) return;
		const mq = window.matchMedia('(max-width: 960px)');
		const sync = () => {
			if (!railEl) return;
			if (!mq.matches) {
				railEl.style.removeProperty('--mobile-sticky-h');
				return;
			}
			railEl.style.setProperty('--mobile-sticky-h', `${playerEl!.offsetHeight + 8}px`);
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
	let videoTime = $state(0);
	let videoPlaying = $state(false);
	let playbackStarted = $state(false);
	let scrollIndex = $state(0);

	function onVideoTime(t: number) {
		videoTime = t;
		if (!playbackStarted && t > 0.3) playbackStarted = true;
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

	// Блок на позиции плеера: держится и на паузе (пока воспроизведение хоть раз начиналось).
	const playingIndex = $derived(playbackStarted ? chapterIndexAt(videoTime) : -1);
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
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const idx = Number((entry.target as HTMLElement).dataset.idx);
					if (entry.isIntersecting) visible.add(idx);
					else visible.delete(idx);
				}
				if (visible.size) scrollIndex = Math.min(...visible);
			},
			{ rootMargin: '-18% 0px -72% 0px', threshold: 0 }
		);

		nodes.forEach((n, i) => {
			n.dataset.idx = String(i);
			io.observe(n);
		});

		return () => io.disconnect();
	});

	function seekVideo(start: number) {
		seekTo = start;
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

	function onSearchHit(hit: SearchHit) {
		if (hit.chapterIndex != null) {
			selectChapter(hit.chapterIndex, hit.start ?? report.chapters[hit.chapterIndex].start);
			return;
		}
		document.querySelector('.report-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>{report.title} — {SITE_NAME}</title>
	<meta name="description" content={report.subtitle} />
</svelte:head>

{#if locked}
	<Lock
		targets={gate}
		title={report.title}
		subtitle="Это видео из закрытой коллекции. Введите пароль, чтобы открыть доступ."
	/>
{:else}
<article class="report container">
	<div class="layout" class:no-video={!report.video}>
		<!-- Слева: плеер + содержание (sticky с самого верха) -->
		<aside class="rail" bind:this={railEl}>
			{#if report.video}
				<div class="video-pin" bind:this={playerEl}>
					<VideoPlayer
						bind:this={playerComp}
						video={report.video}
						{seekTo}
						onTime={onVideoTime}
						onPlaying={(p) => (videoPlaying = p)}
					/>
					<p class="video-hint label">Клик по блоку — перемотка</p>
				</div>
			{/if}
			<div class="nav-scroll">
				<ReportSearch {report} onHit={onSearchHit} />
				<ChapterNav chapters={report.chapters} onSelect={selectChapter} active={navActive} />
			</div>
		</aside>

		<!-- Справа: заголовок и текст -->
		<div class="content">
			<header class="report-head reveal" {@attach reveal()}>
				<h1>{report.title}</h1>
				<p class="subtitle">{report.subtitle}</p>
				<p class="views label">
					<VisitCounter target={{ kind: 'report', slug: report.slug }} />
				</p>
			</header>

			<section class="chapters">
				{#each report.chapters as chapter, i (chapter.start)}
					<div class="reveal" {@attach reveal()}>
						<ChapterCard
							{chapter}
							index={i}
							onSeek={report.video ? seekVideo : undefined}
							playing={playingIndex === i}
							live={videoPlaying && playingIndex === i}
						/>
					</div>
				{/each}
			</section>

			{#if report.transcript}
				<section class="transcript reveal" {@attach reveal()}>
					<details>
						<summary><span class="label">Полная расшифровка</span></summary>
						<p>{report.transcript}</p>
					</details>
				</section>
			{/if}

			<p class="source label">{report.source_name}</p>
		</div>
	</div>
</article>
{/if}

<style>
	.report {
		padding-top: 20px;
		padding-bottom: 48px;
		max-width: 1320px;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(300px, 36%) minmax(0, 1fr);
		gap: clamp(32px, 4vw, 56px);
		align-items: start;
	}

	.layout.no-video {
		grid-template-columns: minmax(240px, 28%) minmax(0, 1fr);
	}

	.rail {
		position: sticky;
		top: 12px;
		align-self: start;
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-height: calc(100vh - 24px);
		min-height: 0;
	}

	.video-pin {
		flex-shrink: 0;
		scroll-margin-top: 12px;
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
		font-size: clamp(28px, 3.2vw, 44px);
		font-weight: 500;
		margin: 0 0 10px;
		max-width: 22ch;
		line-height: 1.08;
	}

	.subtitle {
		font-size: clamp(17px, 1.6vw, 20px);
		color: var(--ink-soft);
		max-width: 52ch;
		margin: 0;
		line-height: 1.45;
	}

	.views {
		margin: 10px 0 0;
		color: var(--ink-faint);
	}

	.chapters {
		margin-top: 32px;
	}

	.transcript {
		margin-top: 40px;
	}

	.transcript details {
		border-top: 1px solid var(--line-strong);
	}

	.transcript summary {
		cursor: pointer;
		padding: 16px 0;
		list-style: none;
		display: flex;
		align-items: center;
	}

	.transcript summary::after {
		content: '+';
		font-family: var(--font-mono);
		color: var(--accent);
		margin-left: auto;
		font-size: 18px;
	}

	.transcript details[open] summary::after {
		content: '−';
	}

	.transcript summary::-webkit-details-marker {
		display: none;
	}

	.transcript p {
		margin: 0 0 24px;
		color: var(--ink-soft);
		font-size: 17px;
		line-height: 1.85;
		max-width: var(--measure);
	}

	.source {
		margin: 32px 0 0;
		color: var(--ink-faint);
		word-break: break-all;
	}

	@media (max-width: 960px) {
		.layout,
		.layout.no-video {
			grid-template-columns: 1fr;
			gap: 24px;
		}

		.rail {
			position: static;
			max-height: none;
		}

		.nav-scroll {
			overflow: visible;
			max-height: none;
		}

		.video-pin {
			position: sticky;
			top: 8px;
			z-index: 5;
			background: var(--paper);
			padding-bottom: 4px;
			box-shadow: 0 10px 0 var(--paper);
		}

		.video-hint {
			display: none;
		}

		.report-head h1 {
			max-width: none;
		}
	}
</style>

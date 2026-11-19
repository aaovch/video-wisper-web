<script lang="ts">
	import { Dialog, DialogContent } from '@ui-sdk/svelte/dialog';
	import { MediaQuery } from 'svelte/reactivity';
	import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/svelte/collapsible';
	import { Button } from '@ui-sdk/svelte/button';
	import type { Chapter, TranscriptChapter, VideoSource } from '$lib/types';
	import { highlightParts } from '$lib/text-highlight';
	import { timedTranscriptParagraphs } from '$lib/transcript-reading';
	import { formatTime } from '$lib/utils';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import Crosshair from 'phosphor-svelte/lib/Crosshair';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import Play from 'phosphor-svelte/lib/Play';
	import VideoPlayer from './VideoPlayer.svelte';
	import { tick } from 'svelte';

	let {
		chapter,
		chapterIndex,
		chapterCount,
		transcriptChapter,
		video,
		sourceUrl,
		initialTime = chapter.start,
		autoplay = false,
		loadState = 'idle',
		highlight = '',
		language = 'ru',
		onClose,
		onPrevious,
		onNext,
		onRetry,
		onTime,
		onPlaying,
		onSeek
	}: {
		chapter: Chapter;
		chapterIndex: number;
		chapterCount: number;
		transcriptChapter?: TranscriptChapter;
		video?: VideoSource;
		sourceUrl?: string;
		initialTime?: number;
		autoplay?: boolean;
		loadState?: 'idle' | 'loading' | 'ready' | 'error';
		highlight?: string;
		language?: 'ru' | 'en';
		onClose: (position: number) => void;
		onPrevious?: () => void;
		onNext?: () => void;
		onRetry?: () => void;
		onTime?: (time: number) => void;
		onPlaying?: (playing: boolean) => void;
		onSeek?: (start: number) => void;
	} = $props();

	let transcriptScrollEl = $state<HTMLElement | null>(null);
	let chapterTitleEl = $state<HTMLHeadingElement | null>(null);
	let playerComp = $state<VideoPlayer | null>(null);
	const compact = new MediaQuery('(max-width: 1099px)');
	let compactVideoOpen = $state(true);
	const videoOpen = $derived(!compact.current || compactVideoOpen);
	let playbackTime = $state(0);
	let playerSeek = $state(0);
	let playing = $state(false);
	let followPlayback = $state(true);
	let renderedChapterIndex = $state(-1);
	let initialized = $state(false);
	const titleId = $derived(`transcript-reader-title-${chapterIndex + 1}`);
	const readableParagraphs = $derived(timedTranscriptParagraphs(transcriptChapter?.segments ?? []));
	const activePhraseStart = $derived.by(() => {
		let active: number | null = null;
		for (const paragraph of readableParagraphs) {
			for (const span of paragraph.spans) {
				if (span.start <= playbackTime + 0.2) active = span.start;
				else return active;
			}
		}
		return active;
	});
	function handleReaderKeydown(event: KeyboardEvent) {
		if (transcriptScrollEl?.contains(event.target as Node) && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) pauseFollowing();
	}

	function closeReader() {
		onClose(playerComp?.currentTime() ?? playbackTime);
	}

	let chapterChangeRequested = false;
	function previousChapter() {
		if (!onPrevious) return;
		chapterChangeRequested = true;
		onPrevious();
	}

	function nextChapter() {
		if (!onNext) return;
		chapterChangeRequested = true;
		onNext();
	}

	function scrollToActive() {
		void tick().then(() => {
			const pane = transcriptScrollEl;
			const active = pane?.querySelector<HTMLElement>('[data-active="true"]');
			if (!pane || !active) return;
			const bounds = pane.getBoundingClientRect();
			const phrase = active.getBoundingClientRect();
			if (phrase.top >= bounds.top && phrase.bottom <= bounds.bottom) return;
			pane.scrollBy({ top: phrase.top - bounds.top - pane.clientHeight / 3, behavior: 'instant' });
		});
	}

	function resumeFollowing() {
		followPlayback = true;
		scrollToActive();
	}

	function pauseFollowing() {
		if (playing) followPlayback = false;
	}

	function handleTime(time: number) {
		playbackTime = time;
		onTime?.(time);
	}

	function handlePlaying(nextPlaying: boolean) {
		playing = nextPlaying;
		onPlaying?.(nextPlaying);
	}

	function seekPhrase(start: number) {
		followPlayback = true;
		playbackTime = start;
		playerSeek = start;
		onSeek?.(start);
		playerComp?.seekAndPlay?.(start);
	}

	$effect(() => {
		if (initialized) return;
		initialized = true;
		playbackTime = initialTime;
		playerSeek = initialTime;
		playing = autoplay;
		renderedChapterIndex = chapterIndex;
	});


	$effect(() => {
		const nextIndex = chapterIndex;
		if (nextIndex === renderedChapterIndex) return;
		renderedChapterIndex = nextIndex;
		followPlayback = true;
		const requested = chapterChangeRequested;
		chapterChangeRequested = false;
		if (requested) {
			playbackTime = chapter.start;
			playerSeek = chapter.start;
			onSeek?.(chapter.start);
		}
		void tick().then(() => {
			transcriptScrollEl?.scrollTo({ top: 0, behavior: 'instant' });
			if (requested) chapterTitleEl?.focus({ preventScroll: true });
		});
	});

	$effect(() => {
		activePhraseStart;
		if (followPlayback && playing) scrollToActive();
	});
</script>

<Dialog defaultOpen closeOnOutsidePress={false} onOpenChange={(open) => { if (!open) closeReader(); }}>
<DialogContent aria-labelledby={titleId} initialFocus=".back" onkeydown={handleReaderKeydown}>
{#snippet render({ props })}
<div {...props} class="reader">
	<div class="reader-inner">
		<header class="reader-nav">
			<Button type="button" onclick={closeReader}>
				{#snippet render({ props })}
					<button {...props} class="back">
				<ArrowLeft size={18} weight="bold" aria-hidden="true" />
				<span>{language === 'en' ? 'Back to notes' : 'К конспекту'}</span>
			</button>
				{/snippet}
			</Button>
			<span class="mode-label">{language === 'en' ? 'Transcript' : 'Расшифровка'}</span>
			<span class="progress" aria-label={language === 'en' ? `Chapter ${chapterIndex + 1} of ${chapterCount}` : `Глава ${chapterIndex + 1} из ${chapterCount}`}>
				{language === 'en' ? 'Chapter' : 'Глава'} {chapterIndex + 1} {language === 'en' ? 'of' : 'из'} {String(chapterCount).padStart(2, '0')}
			</span>
		</header>

		<div class="reader-workspace" class:video-collapsed={!videoOpen}>
			<aside class="video-pane" aria-label={language === 'en' ? 'Video' : 'Видео'}>
				<Collapsible bind:open={() => videoOpen, (open) => compactVideoOpen = open}>
					{#if video}
						<CollapsibleTrigger>
							{#snippet render({ props })}
								<button {...props} class="video-toggle">
									<span>{videoOpen
										? (language === 'en' ? 'Collapse video' : 'Свернуть видео')
										: (language === 'en' ? 'Show video' : 'Показать видео')}</span>
									{#if videoOpen}<CaretUp size={16} aria-hidden="true" />{:else}<CaretDown size={16} aria-hidden="true" />{/if}
								</button>
							{/snippet}
						</CollapsibleTrigger>
					{/if}
					<CollapsiblePanel keepMounted>
						<div class="video-stage">
							{#if video}
								<VideoPlayer
									bind:this={playerComp}
									{video}
									{sourceUrl}
									seekTo={playerSeek}
									{autoplay}
									onTime={handleTime}
									onPlaying={handlePlaying}
									{language}
								/>
							{:else}
								<div class="video-empty">{language === 'en' ? 'This material has no embedded video.' : 'Для этого материала нет встроенного видео.'}</div>
							{/if}
						</div>
					</CollapsiblePanel>
				</Collapsible>
			</aside>

			<main
				class="transcript-pane"
				bind:this={transcriptScrollEl}
				onwheel={pauseFollowing}
				ontouchmove={pauseFollowing}
				onpointerdown={(event) => {
					if ((event.target as HTMLElement).closest('.phrase')) return;
					pauseFollowing();
				}}
			>
				<div class="reader-content">
					<div class="chapter-meta">
						<Button type="button" onclick={() => seekPhrase(chapter.start)} title={language === 'en' ? 'Watch from this point' : 'Смотреть с этого момента'}>
							{#snippet render({ props })}
								<button {...props} class="timecode">
							<Play size={10} weight="fill" aria-hidden="true" />
							<span>{formatTime(chapter.start)}</span>
						</button>
							{/snippet}
						</Button>
					</div>

					<h2 id={titleId} bind:this={chapterTitleEl} tabindex="-1">
						{#each highlightParts(chapter.title, highlight) as part}
							{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}
						{/each}
					</h2>

					{#if !followPlayback && activePhraseStart !== null}
						<Button type="button" onclick={resumeFollowing}>
							{#snippet render({ props })}
								<button {...props} class="follow-button">
							<Crosshair size={16} weight="bold" aria-hidden="true" />
							{language === 'en' ? 'Return to current position' : 'Вернуться к текущему месту'}
						</button>
							{/snippet}
						</Button>
					{/if}

					{#if loadState === 'ready' && readableParagraphs.length}
						<div class="transcript-copy">
							{#each readableParagraphs as paragraph}
								<p>
									{#each paragraph.spans as span, spanIndex}
										{#if spanIndex > 0}{' '}{/if}<Button type="button" data-active={span.start === activePhraseStart ? 'true' : undefined} aria-current={span.start === activePhraseStart ? 'true' : undefined} title={`${language === 'en' ? 'Watch from' : 'Смотреть с'} ${formatTime(span.start)}`} onclick={() => seekPhrase(span.start)}>
											{#snippet render({ props })}
												<button {...props} class="phrase" class:active={span.start === activePhraseStart}>{#each highlightParts(span.text, highlight) as part}{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</button>
											{/snippet}
										</Button>
									{/each}
								</p>
							{/each}
						</div>
					{:else if loadState === 'error'}
						<div class="message" role="alert">
							<p>{language === 'en' ? 'The transcript could not be loaded.' : 'Не удалось загрузить расшифровку.'}</p>
							{#if onRetry}<Button type="button" onclick={onRetry}>
								{#snippet render({ props })}
									<button {...props}>{language === 'en' ? 'Try again' : 'Попробовать ещё раз'}</button>
								{/snippet}
							</Button>{/if}
						</div>
					{:else if loadState === 'ready'}
						<p class="message">{language === 'en' ? 'This chapter has no transcript text.' : 'Для этого блока нет текста расшифровки.'}</p>
					{:else}
						<div class="loading" aria-live="polite" aria-label={language === 'en' ? 'Loading transcript' : 'Загрузка расшифровки'}>
							<span></span><span></span><span></span><span></span>
						</div>
					{/if}

					<footer class="reader-footer">
						{#if onPrevious}
							<Button type="button" onclick={previousChapter}>
								{#snippet render({ props })}
									<button {...props} class="previous">
								<ArrowLeft size={18} weight="bold" aria-hidden="true" />
								<span>{language === 'en' ? 'Previous chapter' : 'Предыдущая глава'}</span>
							</button>
								{/snippet}
							</Button>
						{/if}
						{#if onNext}
							<Button type="button" onclick={nextChapter}>
								{#snippet render({ props })}
									<button {...props} class="next">
								<span>{language === 'en' ? 'Next chapter' : 'Следующая глава'}</span>
								<ArrowRight size={18} weight="bold" aria-hidden="true" />
							</button>
								{/snippet}
							</Button>
						{:else}
							<Button type="button" onclick={closeReader}>
								{#snippet render({ props })}
									<button {...props} class="next">
								<span>{language === 'en' ? 'Back to notes' : 'Вернуться к конспекту'}</span>
								<ArrowLeft size={18} weight="bold" aria-hidden="true" />
							</button>
								{/snippet}
							</Button>
						{/if}
					</footer>
				</div>
			</main>
		</div>
	</div>
</div>
{/snippet}
</DialogContent>
</Dialog>

<style>
	.reader { position: fixed; inset: 0; z-index: 200; width: 100%; max-width: none; height: 100dvh; max-height: none; margin: 0; padding: 0; border: 0; overflow: hidden; background: var(--paper); color: var(--ink); }
	.reader::backdrop { background: var(--paper); }
	.reader-inner { display: grid; grid-template-rows: auto minmax(0, 1fr); height: 100dvh; }
	.reader-nav { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 24px; min-height: 72px; padding: 12px clamp(20px, 3vw, 42px); border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--paper) 96%, transparent); }
	.back, .previous, .next, .follow-button, .video-toggle { display: inline-flex; align-items: center; gap: 9px; min-height: 44px; border: 0; background: transparent; color: var(--accent); font-family: var(--font-ui); font-size: var(--text-control); font-weight: 600; cursor: pointer; }
	.back { justify-self: start; padding: 7px 2px; }
	.back:hover :global(svg), .previous:hover :global(svg) { transform: translateX(-4px); }
	.next:hover :global(svg) { transform: translateX(4px); }
	.back :global(svg), .previous :global(svg), .next :global(svg) { flex: 0 0 auto; transition: transform 0.18s ease; }
	.back:focus-visible, .previous:focus-visible, .next:focus-visible, .video-toggle:focus-visible, .timecode:focus-visible, .follow-button:focus-visible, .phrase:focus-visible, .message button:focus-visible, h2:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; border-radius: 3px; }
	.mode-label, .progress { font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: 0.02em; text-transform: uppercase; color: var(--ink-faint); }
	.mode-label { justify-self: center; }
	.progress { justify-self: end; }
	.reader-workspace { display: grid; grid-template-columns: minmax(300px, 38%) minmax(0, 1fr); min-height: 0; }
	.video-pane { display: flex; flex-direction: column; justify-content: center; min-width: 0; padding: clamp(22px, 4vw, 62px); border-right: 1px solid var(--line); background: color-mix(in srgb, var(--ink) 4%, var(--paper)); }
	.video-stage { width: 100%; overflow: hidden; border-radius: 10px; }
	.video-toggle { display: none; }
	.video-stage :global(.player) { width: 100%; }
	.video-empty { display: grid; min-height: 220px; place-items: center; padding: 24px; color: var(--ink-faint); text-align: center; }
	.transcript-pane { min-width: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
	.reader-content { width: min(100%, 760px); min-height: 100%; margin: 0 auto; padding: clamp(40px, 7vh, 72px) clamp(24px, 5vw, 68px) 36px; }
	.chapter-meta { display: flex; align-items: center; gap: 14px; margin-bottom: 17px; }
	.timecode { display: inline-flex; align-items: center; gap: 7px; min-height: var(--hit); padding: 5px 11px; border: 1px solid var(--line-strong); border-radius: 999px; background: transparent; color: var(--ink-soft); font-family: var(--font-mono); font-size: 11px; cursor: pointer; }
	.timecode :global(svg) { color: var(--accent); }
	.timecode:hover { color: var(--paper); background: var(--accent); border-color: var(--accent); }
	.timecode:hover :global(svg) { color: var(--paper); }
	h2 { max-width: 20ch; margin: 0 0 clamp(30px, 5vh, 48px); font-family: var(--font-display); font-size: clamp(34px, 4.3vw, 54px); font-weight: 450; line-height: 1.15; letter-spacing: -0.025em; text-wrap: balance; }
	.follow-button { position: sticky; top: 12px; z-index: 2; margin: -18px 0 24px; padding: 8px 13px; border: 1px solid var(--line-strong); border-radius: 999px; background: var(--paper); box-shadow: 0 8px 24px color-mix(in srgb, var(--ink) 10%, transparent); }
	.transcript-copy { max-width: 65ch; }
	.transcript-copy p { margin: 0 0 1.38em; color: var(--ink-soft); font-size: clamp(18px, 1.6vw, 20px); line-height: 1.62; text-wrap: pretty; }
	.phrase { display: inline; margin: 0; padding: 2px 1px; border: 0; border-radius: 3px; background: transparent; color: inherit; font: inherit; line-height: inherit; text-align: left; cursor: pointer; box-decoration-break: clone; -webkit-box-decoration-break: clone; transition: color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease; }
	.phrase:hover { color: var(--ink); background: color-mix(in srgb, var(--accent) 7%, transparent); }
	.phrase.active { color: var(--ink); background: color-mix(in srgb, var(--accent) 15%, var(--paper)); }
	.reader-footer { display: flex; justify-content: space-between; gap: 16px; margin-top: clamp(36px, 7vh, 70px); padding-top: 22px; border-top: 1px solid var(--line); }
	.previous, .next { min-width: 0; max-width: calc(50% - 8px); padding: 7px 2px; }
	.previous { text-align: left; }
	.next { margin-left: auto; text-align: right; }
	.message { color: var(--ink-faint); font-size: 17px; line-height: 1.6; }
	.message button { min-height: 44px; padding: 8px 13px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: transparent; color: var(--accent); font-family: var(--font-ui); cursor: pointer; }
	.loading { display: grid; gap: 13px; max-width: 65ch; padding-top: 4px; }
	.loading span { display: block; height: 15px; border-radius: 3px; background: color-mix(in srgb, var(--line-strong) 54%, transparent); animation: pulse 1.2s ease-in-out infinite alternate; }
	.loading span:nth-child(2) { width: 92%; animation-delay: 0.1s; }
	.loading span:nth-child(3) { width: 98%; animation-delay: 0.2s; }
	.loading span:nth-child(4) { width: 68%; animation-delay: 0.3s; }
	@keyframes pulse { to { opacity: 0.42; } }
	mark { background: var(--mark); color: var(--mark-ink); font-weight: 600; }
	@media (max-width: 1099px) {
		.reader-nav { grid-template-columns: 1fr auto; min-height: 60px; padding: 8px 18px; }
		.mode-label { display: none; }
		.reader-workspace { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
		.video-pane { padding: 12px 16px 10px; border-right: 0; border-bottom: 1px solid var(--line); }
		.video-stage { width: min(100%, 520px, 48dvh); margin: 0 auto; border-radius: 7px; }
		.video-toggle { display: flex; justify-content: flex-end; width: min(100%, 520px, 48dvh); margin: 0 auto; padding: 4px 2px; font-size: var(--text-label); }
		.reader-content { padding: 32px 21px 28px; }
		h2 { margin-bottom: 30px; font-size: clamp(32px, 9vw, 43px); }
		.transcript-copy p { font-size: 18px; line-height: 1.7; }
		.reader-footer { padding-bottom: max(0px, env(safe-area-inset-bottom)); }
	}
	@media (max-width: 520px) {
		.video-pane { padding-inline: 10px; }
		.reader-nav { padding-inline: 14px; }
		.back span { font-size: var(--text-label); }
		.previous, .next { font-size: var(--text-label); }
	}
	@media (orientation: landscape) and (max-height: 500px) {
		.reader-nav { min-height: 48px; padding-block: 2px; }
		.reader-workspace { grid-template-columns: 42% minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
		.video-pane { padding: 8px; overflow-y: auto; border-right: 1px solid var(--line); border-bottom: 0; }
		.reader-content { padding: 20px; }
	}
	@media (max-width: 1099px) and (orientation: landscape) and (max-height: 500px) {
		.reader-workspace.video-collapsed { grid-template-columns: auto minmax(0, 1fr); }
	}
	@media (prefers-reduced-motion: reduce) {
		.loading span { animation: none; }
		.back :global(svg), .previous :global(svg), .next :global(svg), .phrase { transition: none; }
	}
</style>

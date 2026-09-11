<script lang="ts">
	import type { Chapter, TranscriptChapter, VideoSource } from '$lib/types';
	import { highlightParts } from '$lib/text-highlight';
	import { timedTranscriptParagraphs } from '$lib/transcript-reading';
	import { formatTime } from '$lib/utils';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import Crosshair from 'phosphor-svelte/lib/Crosshair';
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
		onClose,
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
		onClose: () => void;
		onNext?: () => void;
		onRetry?: () => void;
		onTime?: (time: number) => void;
		onPlaying?: (playing: boolean) => void;
		onSeek?: (start: number) => void;
	} = $props();

	let readerEl = $state<HTMLDialogElement | null>(null);
	let closeButton = $state<HTMLButtonElement | null>(null);
	let transcriptScrollEl = $state<HTMLElement | null>(null);
	let playerComp = $state<{ seekAndPlay?: (time: number) => void } | null>(null);
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
	const focusableSelector = [
		'button:not([disabled])',
		'a[href]',
		'iframe',
		'video[controls]',
		'input:not([disabled])',
		'select:not([disabled])',
		'textarea:not([disabled])',
		'[tabindex]:not([tabindex="-1"])'
	].join(',');

	function handleReaderKeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab' || !readerEl) return;
		const focusable = Array.from(readerEl.querySelectorAll<HTMLElement>(focusableSelector))
			.filter((element) => element.getClientRects().length > 0);
		if (!focusable.length) return;

		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;
		if (event.shiftKey && (active === first || !readerEl.contains(active))) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (active === last || !readerEl.contains(active))) {
			event.preventDefault();
			first.focus();
		}
	}

	function scrollToActive(behavior: ScrollBehavior = 'smooth') {
		void tick().then(() => {
			const active = transcriptScrollEl?.querySelector<HTMLElement>('[data-active="true"]');
			active?.scrollIntoView({ behavior, block: 'center' });
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
		scrollToActive();
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
		if (!readerEl) return;
		if (!readerEl.open) readerEl.showModal();
		void tick().then(() => closeButton?.focus());
		return () => {
			if (readerEl?.open) readerEl.close();
		};
	});

	$effect(() => {
		const nextIndex = chapterIndex;
		if (nextIndex === renderedChapterIndex) return;
		renderedChapterIndex = nextIndex;
		followPlayback = true;
		playbackTime = chapter.start;
		playerSeek = chapter.start;
		onSeek?.(chapter.start);
		void tick().then(() => transcriptScrollEl?.scrollTo({ top: 0, behavior: 'instant' }));
	});

	$effect(() => {
		activePhraseStart;
		if (followPlayback && playing) scrollToActive();
	});
</script>

<dialog
	class="reader"
	aria-labelledby={titleId}
	bind:this={readerEl}
	onkeydown={handleReaderKeydown}
	oncancel={(event) => {
		event.preventDefault();
		onClose();
	}}
>
	<div class="reader-inner">
		<header class="reader-nav">
			<button bind:this={closeButton} type="button" class="back" onclick={onClose}>
				<ArrowLeft size={18} weight="bold" aria-hidden="true" />
				<span>К конспекту</span>
			</button>
			<span class="mode-label">Видео + расшифровка</span>
			<span class="progress" aria-label="Блок {chapterIndex + 1} из {chapterCount}">
				{String(chapterIndex + 1).padStart(2, '0')} из {String(chapterCount).padStart(2, '0')}
			</span>
		</header>

		<div class="reader-workspace">
			<aside class="video-pane" aria-label="Видео">
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
						/>
					{:else}
						<div class="video-empty">Для этого материала нет встроенного видео.</div>
					{/if}
				</div>
				<div class="video-caption">
					<span class:live={playing}><i></i>{playing ? 'Синхронизация включена' : 'Нажмите Play для синхронизации'}</span>
					<time>{formatTime(playbackTime)}</time>
				</div>
			</aside>

			<main
				class="transcript-pane"
				bind:this={transcriptScrollEl}
				onwheel={pauseFollowing}
				onpointerdown={(event) => {
					if ((event.target as HTMLElement).closest('.phrase')) return;
					pauseFollowing();
				}}
			>
				<div class="reader-content">
					<div class="chapter-meta">
						<span class="chapter-number">{String(chapterIndex + 1).padStart(2, '0')}</span>
						<button type="button" class="timecode" onclick={() => seekPhrase(chapter.start)} title="Смотреть с этого момента">
							<Play size={10} weight="fill" aria-hidden="true" />
							<span>{formatTime(chapter.start)}</span>
						</button>
					</div>

					<h2 id={titleId}>
						{#each highlightParts(chapter.title, highlight) as part}
							{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}
						{/each}
					</h2>

					{#if !followPlayback && activePhraseStart !== null}
						<button type="button" class="follow-button" onclick={resumeFollowing}>
							<Crosshair size={16} weight="bold" aria-hidden="true" />
							Вернуться к текущему месту
						</button>
					{/if}

					{#if loadState === 'ready' && readableParagraphs.length}
						<div class="transcript-copy">
							{#each readableParagraphs as paragraph}
								<p>
									{#each paragraph.spans as span, spanIndex}
										{#if spanIndex > 0}{' '}{/if}<button
											type="button"
											class="phrase"
											class:active={span.start === activePhraseStart}
											data-active={span.start === activePhraseStart ? 'true' : undefined}
											aria-current={span.start === activePhraseStart ? 'true' : undefined}
											title={`Смотреть с ${formatTime(span.start)}`}
											onclick={() => seekPhrase(span.start)}
										>{#each highlightParts(span.text, highlight) as part}{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</button>
									{/each}
								</p>
							{/each}
						</div>
					{:else if loadState === 'error'}
						<div class="message" role="alert">
							<p>Не удалось загрузить расшифровку.</p>
							{#if onRetry}<button type="button" onclick={onRetry}>Попробовать ещё раз</button>{/if}
						</div>
					{:else if loadState === 'ready'}
						<p class="message">Для этого блока нет текста расшифровки.</p>
					{:else}
						<div class="loading" aria-live="polite" aria-label="Загрузка расшифровки">
							<span></span><span></span><span></span><span></span>
						</div>
					{/if}

					<footer class="reader-footer">
						{#if onNext}
							<button type="button" class="next" onclick={onNext}>
								<span>Следующий блок</span>
								<ArrowRight size={18} weight="bold" aria-hidden="true" />
							</button>
						{:else}
							<button type="button" class="next" onclick={onClose}>
								<span>Вернуться к конспекту</span>
								<ArrowLeft size={18} weight="bold" aria-hidden="true" />
							</button>
						{/if}
					</footer>
				</div>
			</main>
		</div>
	</div>
</dialog>

<style>
	.reader { position: fixed; inset: 0; z-index: 200; width: 100%; max-width: none; height: 100dvh; max-height: none; margin: 0; padding: 0; border: 0; overflow: hidden; background: var(--paper); color: var(--ink); }
	.reader::backdrop { background: var(--paper); }
	.reader-inner { display: grid; grid-template-rows: auto minmax(0, 1fr); height: 100dvh; }
	.reader-nav { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 24px; min-height: 72px; padding: 12px clamp(20px, 3vw, 42px); border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--paper) 96%, transparent); }
	.back, .next, .follow-button { display: inline-flex; align-items: center; gap: 9px; min-height: 44px; border: 0; background: transparent; color: var(--accent); font-family: var(--font-ui); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
	.back { justify-self: start; padding: 7px 2px; }
	.back:hover :global(svg) { transform: translateX(-4px); }
	.next:hover :global(svg) { transform: translateX(4px); }
	.back :global(svg), .next :global(svg) { flex: 0 0 auto; transition: transform 0.18s ease; }
	.back:focus-visible, .next:focus-visible, .timecode:focus-visible, .follow-button:focus-visible, .phrase:focus-visible, .message button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 3px; }
	.mode-label, .progress { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
	.mode-label { justify-self: center; }
	.progress { justify-self: end; }
	.reader-workspace { display: grid; grid-template-columns: minmax(380px, 45%) minmax(0, 1fr); min-height: 0; }
	.video-pane { display: flex; flex-direction: column; justify-content: center; min-width: 0; padding: clamp(22px, 4vw, 62px); border-right: 1px solid var(--line); background: color-mix(in srgb, var(--ink) 4%, var(--paper)); }
	.video-stage { width: 100%; overflow: hidden; border-radius: 10px; box-shadow: 0 18px 60px color-mix(in srgb, var(--ink) 13%, transparent); }
	.video-stage :global(.player) { width: 100%; }
	.video-empty { display: grid; min-height: 220px; place-items: center; padding: 24px; color: var(--ink-faint); text-align: center; }
	.video-caption { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding-top: 14px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); }
	.video-caption span { display: inline-flex; align-items: center; gap: 8px; }
	.video-caption i { display: block; width: 7px; height: 7px; border-radius: 50%; background: var(--ink-faint); }
	.video-caption span.live { color: var(--accent); }
	.video-caption span.live i { background: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 14%, transparent); }
	.transcript-pane { min-width: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
	.reader-content { width: min(100%, 760px); min-height: 100%; margin: 0 auto; padding: clamp(40px, 7vh, 72px) clamp(24px, 5vw, 68px) 36px; }
	.chapter-meta { display: flex; align-items: center; gap: 14px; margin-bottom: 17px; }
	.chapter-number { font-family: var(--font-display); font-size: 30px; font-weight: 500; line-height: 1; color: var(--accent); }
	.timecode { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 5px 11px; border: 1px solid var(--line-strong); border-radius: 999px; background: transparent; color: var(--ink-soft); font-family: var(--font-mono); font-size: 11px; cursor: pointer; }
	.timecode :global(svg) { color: var(--accent); }
	.timecode:hover { color: var(--paper); background: var(--accent); border-color: var(--accent); }
	.timecode:hover :global(svg) { color: var(--paper); }
	h2 { max-width: 20ch; margin: 0 0 clamp(30px, 5vh, 48px); font-family: var(--font-display); font-size: clamp(34px, 4.3vw, 54px); font-weight: 450; line-height: 1.04; letter-spacing: -0.025em; text-wrap: balance; }
	.follow-button { position: sticky; top: 12px; z-index: 2; margin: -18px 0 24px; padding: 8px 13px; border: 1px solid var(--line-strong); border-radius: 999px; background: var(--paper); box-shadow: 0 8px 24px color-mix(in srgb, var(--ink) 10%, transparent); }
	.transcript-copy { max-width: 65ch; }
	.transcript-copy p { margin: 0 0 1.38em; color: var(--ink-soft); font-size: clamp(18px, 1.6vw, 20px); line-height: 1.76; text-wrap: pretty; }
	.phrase { display: inline; margin: 0; padding: 2px 1px; border: 0; border-radius: 3px; background: transparent; color: inherit; font: inherit; line-height: inherit; text-align: left; cursor: pointer; box-decoration-break: clone; -webkit-box-decoration-break: clone; transition: color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease; }
	.phrase:hover { color: var(--ink); background: color-mix(in srgb, var(--accent) 7%, transparent); }
	.phrase.active { color: var(--ink); background: color-mix(in srgb, var(--accent) 15%, var(--paper)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent); }
	.reader-footer { display: flex; justify-content: flex-end; margin-top: clamp(36px, 7vh, 70px); padding-top: 22px; border-top: 1px solid var(--line); }
	.next { padding: 7px 2px; }
	.message { color: var(--ink-faint); font-size: 17px; line-height: 1.6; }
	.message button { min-height: 44px; padding: 8px 13px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: transparent; color: var(--accent); font-family: var(--font-ui); cursor: pointer; }
	.loading { display: grid; gap: 13px; max-width: 65ch; padding-top: 4px; }
	.loading span { display: block; height: 15px; border-radius: 3px; background: color-mix(in srgb, var(--line-strong) 54%, transparent); animation: pulse 1.2s ease-in-out infinite alternate; }
	.loading span:nth-child(2) { width: 92%; animation-delay: 0.1s; }
	.loading span:nth-child(3) { width: 98%; animation-delay: 0.2s; }
	.loading span:nth-child(4) { width: 68%; animation-delay: 0.3s; }
	@keyframes pulse { to { opacity: 0.42; } }
	mark { background: color-mix(in srgb, var(--accent) 13%, var(--paper)); color: var(--accent-ink); font-weight: 600; }
	@media (max-width: 820px) {
		.reader-nav { grid-template-columns: 1fr auto; min-height: 60px; padding: 8px 18px; }
		.mode-label { display: none; }
		.reader-workspace { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
		.video-pane { padding: 12px 16px 10px; border-right: 0; border-bottom: 1px solid var(--line); }
		.video-stage { width: min(100%, 520px); margin: 0 auto; border-radius: 7px; }
		.video-caption { width: min(100%, 520px); margin: 0 auto; padding-top: 8px; }
		.reader-content { padding: 32px 21px 28px; }
		h2 { margin-bottom: 30px; font-size: clamp(32px, 9vw, 43px); }
		.transcript-copy p { font-size: 18px; line-height: 1.7; }
		.reader-footer { padding-bottom: max(0px, env(safe-area-inset-bottom)); }
	}
	@media (max-width: 430px) {
		.video-caption span { font-size: 9px; letter-spacing: 0.04em; }
		.video-pane { padding-inline: 10px; }
		.reader-nav { padding-inline: 14px; }
		.back span { font-size: 10px; }
	}
	@media (prefers-reduced-motion: reduce) {
		.loading span { animation: none; }
		.back :global(svg), .next :global(svg), .phrase { transition: none; }
	}
</style>

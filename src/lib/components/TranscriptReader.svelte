<script lang="ts">
	import type { Chapter, TranscriptChapter } from '$lib/types';
	import { highlightParts } from '$lib/text-highlight';
	import { transcriptParagraphs } from '$lib/transcript-reading';
	import { formatTime } from '$lib/utils';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import Play from 'phosphor-svelte/lib/Play';
	import { tick } from 'svelte';

	let {
		chapter,
		chapterIndex,
		chapterCount,
		transcriptChapter,
		loadState = 'idle',
		highlight = '',
		onClose,
		onNext,
		onRetry,
		onSeek
	}: {
		chapter: Chapter;
		chapterIndex: number;
		chapterCount: number;
		transcriptChapter?: TranscriptChapter;
		loadState?: 'idle' | 'loading' | 'ready' | 'error';
		highlight?: string;
		onClose: () => void;
		onNext?: () => void;
		onRetry?: () => void;
		onSeek?: (start: number) => void;
	} = $props();

	let readerEl = $state<HTMLDialogElement | null>(null);
	let closeButton = $state<HTMLButtonElement | null>(null);
	const titleId = $derived(`transcript-reader-title-${chapterIndex + 1}`);
	const readableParagraphs = $derived(transcriptParagraphs(transcriptChapter?.segments ?? []));
	const focusableSelector = [
		'button:not([disabled])',
		'a[href]',
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

	$effect(() => {
		if (!readerEl) return;
		if (!readerEl.open) readerEl.showModal();
		void tick().then(() => closeButton?.focus());
		return () => {
			if (readerEl?.open) readerEl.close();
		};
	});

	$effect(() => {
		chapterIndex;
		void tick().then(() => readerEl?.scrollTo({ top: 0, behavior: 'instant' }));
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
			<span class="progress" aria-label="Блок {chapterIndex + 1} из {chapterCount}">
				{String(chapterIndex + 1).padStart(2, '0')} из {String(chapterCount).padStart(2, '0')}
			</span>
		</header>

		<main class="reader-content">
			<div class="chapter-meta">
				<span class="chapter-number">{String(chapterIndex + 1).padStart(2, '0')}</span>
				{#if onSeek}
					<button type="button" class="timecode" onclick={() => onSeek?.(chapter.start)} title="Смотреть с этого момента">
						<Play size={10} weight="fill" aria-hidden="true" />
						<span>{formatTime(chapter.start)}</span>
					</button>
				{:else}
					<span class="timecode timecode-static">{formatTime(chapter.start)}</span>
				{/if}
			</div>

			<h2 id={titleId}>
				{#each highlightParts(chapter.title, highlight) as part}
					{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}
				{/each}
			</h2>

			{#if loadState === 'ready' && readableParagraphs.length}
				<div class="transcript-copy">
					{#each readableParagraphs as paragraph}
						<p>
							{#each highlightParts(paragraph, highlight) as part}
								{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}
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
		</main>

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
</dialog>

<style>
	.reader {
		position: fixed;
		inset: 0;
		z-index: 200;
		width: 100%;
		max-width: none;
		height: 100dvh;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: var(--paper);
		color: var(--ink);
	}

	.reader::backdrop { background: var(--paper); }

	.reader-inner {
		display: flex;
		flex-direction: column;
		width: min(100%, 780px);
		min-height: 100dvh;
		margin: 0 auto;
		padding: 30px clamp(22px, 6vw, 64px) 36px;
	}

	.reader-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding-bottom: 28px;
		border-bottom: 1px solid var(--line);
	}

	.back,
	.next {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		min-height: 44px;
		padding: 7px 2px;
		border: 0;
		background: transparent;
		color: var(--accent);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.back:hover :global(svg) { transform: translateX(-4px); }
	.next:hover :global(svg) { transform: translateX(4px); }
	.back :global(svg), .next :global(svg) { flex: 0 0 auto; transition: transform 0.18s ease; }
	.back:focus-visible, .next:focus-visible, .timecode:focus-visible, .message button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
		border-radius: 3px;
	}

	.progress {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.reader-content {
		flex: 1;
		padding: clamp(46px, 8vh, 78px) 0 38px;
	}

	.chapter-meta {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 17px;
	}

	.chapter-number {
		font-family: var(--font-display);
		font-size: 30px;
		font-weight: 500;
		line-height: 1;
		color: var(--accent);
	}

	.timecode {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		min-height: 34px;
		padding: 5px 11px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: transparent;
		color: var(--ink-soft);
		font-family: var(--font-mono);
		font-size: 11px;
		cursor: pointer;
	}

	.timecode :global(svg) { color: var(--accent); }
	.timecode:hover { color: var(--paper); background: var(--accent); border-color: var(--accent); }
	.timecode:hover :global(svg) { color: var(--paper); }
	.timecode-static { cursor: default; }

	h2 {
		max-width: 18ch;
		margin: 0 0 clamp(36px, 6vh, 56px);
		font-family: var(--font-display);
		font-size: clamp(34px, 7vw, 54px);
		font-weight: 450;
		line-height: 1.04;
		letter-spacing: -0.025em;
		text-wrap: balance;
	}

	.transcript-copy { max-width: 65ch; }
	.transcript-copy p {
		margin: 0 0 1.38em;
		color: var(--ink-soft);
		font-size: clamp(18px, 2.8vw, 20px);
		line-height: 1.76;
		text-wrap: pretty;
	}

	.reader-footer {
		display: flex;
		justify-content: flex-end;
		padding-top: 22px;
		border-top: 1px solid var(--line);
	}

	.next { flex-direction: row; }
	.message { color: var(--ink-faint); font-size: 17px; line-height: 1.6; }
	.message button {
		min-height: 44px;
		padding: 8px 13px;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius);
		background: transparent;
		color: var(--accent);
		font-family: var(--font-ui);
		cursor: pointer;
	}

	.loading { display: grid; gap: 13px; max-width: 65ch; padding-top: 4px; }
	.loading span {
		display: block;
		height: 15px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--line-strong) 54%, transparent);
		animation: pulse 1.2s ease-in-out infinite alternate;
	}
	.loading span:nth-child(2) { width: 92%; animation-delay: 0.1s; }
	.loading span:nth-child(3) { width: 98%; animation-delay: 0.2s; }
	.loading span:nth-child(4) { width: 68%; animation-delay: 0.3s; }
	@keyframes pulse { to { opacity: 0.42; } }

	mark { background: color-mix(in srgb, var(--accent) 13%, var(--paper)); color: var(--accent-ink); font-weight: 600; }

	@media (max-width: 560px) {
		.reader-inner { padding: 18px 20px 26px; }
		.reader-nav { padding-bottom: 18px; }
		.reader-content { padding-top: 38px; }
		h2 { margin-bottom: 34px; font-size: clamp(34px, 10vw, 43px); }
		.transcript-copy p { font-size: 18px; line-height: 1.7; }
		.reader-footer { padding-bottom: max(0px, env(safe-area-inset-bottom)); }
	}

	@media (prefers-reduced-motion: reduce) {
		.loading span { animation: none; }
		.back :global(svg), .next :global(svg) { transition: none; }
	}
</style>

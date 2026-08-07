<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import VisitCounter from '$lib/components/VisitCounter.svelte';
	import ArrowUp from 'phosphor-svelte/lib/ArrowUp';
	import {
		beginNavInstant,
		endNavInstant,
		flushVisibleReveals,
		initPrerenderedReveals
	} from '$lib/attachments';
	import { SITE_NAME, SITE_TAGLINE } from '$lib/site';
	import { trackPageVisit } from '$lib/visit-tracker';
	import { onMount, tick } from 'svelte';

	let { children } = $props();
	const home = $derived(page.route.id === '/');

	let progressEl = $state<HTMLDivElement | null>(null);
	let progressRaf = 0;
	let showTop = $state(false);

	function updateProgress() {
		if (progressRaf) return;
		progressRaf = requestAnimationFrame(() => {
			progressRaf = 0;
			const doc = document.documentElement;
			const max = doc.scrollHeight - doc.clientHeight;
			const p = max > 0 ? Math.min(1, doc.scrollTop / max) : 0;
			if (progressEl) progressEl.style.transform = `scaleX(${p})`;
			const next = doc.scrollTop > doc.clientHeight * 1.5;
			if (next !== showTop) showTop = next;
		});
	}

	function scrollToTop() {
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
	}

	function resetProgress() {
		if (progressEl) progressEl.style.transform = 'scaleX(0)';
	}

	onMount(async () => {
		await tick();
		initPrerenderedReveals();
		flushVisibleReveals();
	});

	beforeNavigate(({ type }) => {
		if (type === 'popstate' || type === 'link' || type === 'goto') {
			beginNavInstant();
		}
	});

	afterNavigate(() => {
		beginNavInstant();
		void (async () => {
			await tick();
			initPrerenderedReveals();
			flushVisibleReveals();
			endNavInstant();
		})();
		resetProgress();
		void trackPageVisit(page.url.pathname);
		updateProgress();
	});
</script>

<svelte:window onscroll={updateProgress} onresize={updateProgress} />

<a class="skip-link" href="#main-content">К содержимому</a>

<div class="progress" bind:this={progressEl} aria-hidden="true"></div>

<div class="floating-controls">
	<ThemeToggle />
</div>

<button
	type="button"
	class="to-top"
	class:visible={showTop}
	onclick={scrollToTop}
	aria-label="Наверх"
	title="Наверх"
	tabindex={showTop ? 0 : -1}
	aria-hidden={!showTop}
>
	<ArrowUp size={18} weight="bold" aria-hidden="true" />
</button>

<div class="sheet">
	{#if home}
		<header class="masthead home">
			<div class="container masthead-inner home">
				<a class="wordmark" href="{base}/">
					<span class="wordmark-main">{SITE_NAME}</span>
					<span class="wordmark-sub label">{SITE_TAGLINE}</span>
				</a>
			</div>
			<hr class="rule" />
		</header>
	{/if}

	<main id="main-content" tabindex="-1">
		{@render children()}
	</main>

	<footer class="colophon">
		<hr class="rule" />
		<div class="container colophon-inner">
			<p class="label">{SITE_NAME} · Whisper Turbo + смысловая LLM-разметка</p>
			<p class="label">
				собрано на SvelteKit ·
				<a href="https://github.com/aaovch" target="_blank" rel="noopener noreferrer">GitHub</a>
				· {new Date().getFullYear()} · <VisitCounter target={{ kind: 'site' }} />
			</p>
		</div>
	</footer>
</div>

<style>
	.progress {
		position: fixed;
		inset: 0 0 auto 0;
		height: 3px;
		z-index: 50;
		background: var(--accent);
		transform-origin: left;
		transform: scaleX(0);
		transition: transform 0.08s linear;
	}

	.floating-controls {
		position: fixed;
		top: 14px;
		right: 16px;
		z-index: 45;
	}

	.to-top {
		position: fixed;
		right: 16px;
		bottom: 20px;
		z-index: 45;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: color-mix(in srgb, var(--paper) 88%, transparent);
		backdrop-filter: blur(6px);
		color: var(--ink-soft);
		box-shadow: var(--shadow);
		cursor: pointer;
		opacity: 0;
		transform: translateY(10px) scale(0.9);
		pointer-events: none;
		transition:
			opacity 0.22s ease,
			transform 0.22s ease,
			color 0.2s ease,
			border-color 0.2s ease;
	}

	.to-top.visible {
		opacity: 1;
		transform: none;
		pointer-events: auto;
	}

	.to-top:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	@media (max-width: 520px) {
		.floating-controls {
			top: 10px;
			right: 10px;
		}

		.to-top {
			right: 10px;
			bottom: 14px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.to-top {
			transition:
				opacity 0.22s ease,
				color 0.2s ease,
				border-color 0.2s ease;
			transform: none;
		}
	}

	.sheet {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		width: calc(100% - clamp(24px, 4vw, 72px));
		max-width: calc(var(--maxw) + 160px);
		margin-inline: auto;
		border-inline: 1px solid color-mix(in srgb, var(--line-strong) 62%, transparent);
		background: var(--paper);
		box-shadow: 0 0 48px color-mix(in srgb, var(--ink) 5%, transparent);
	}

	main {
		flex: 1;
	}

	.masthead-inner {
		display: flex;
		align-items: center;
		gap: 28px;
		padding-top: 18px;
		padding-bottom: 14px;
	}

	.masthead-inner.home {
		padding-top: 22px;
		padding-bottom: 18px;
	}

	.wordmark {
		display: flex;
		align-items: baseline;
		gap: 22px;
		color: var(--ink);
		flex-shrink: 0;
	}

	.wordmark-main {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 30px;
		letter-spacing: -0.02em;
		line-height: 1;
	}

	.wordmark-sub {
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		color: var(--ink-soft);
	}

	.colophon {
		margin-top: 80px;
	}

	.colophon a {
		color: var(--ink-soft);
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s ease;
	}

	.colophon a:hover {
		border-color: var(--accent);
		color: var(--ink);
	}

	.colophon-inner {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		padding-top: 18px;
		padding-bottom: 36px;
	}

	.colophon-inner p {
		margin: 0;
	}

	@media (max-width: 960px) {
		.sheet {
			width: 100%;
			border-inline: 0;
			box-shadow: none;
		}
	}

	@media (max-width: 900px) {
		.masthead-inner {
			flex-wrap: wrap;
			align-items: flex-start;
		}

		.wordmark-main {
			font-size: 27px;
		}
	}

	@media (max-width: 520px) {
		.masthead-inner,
		.masthead-inner.home {
			padding-top: 14px;
			padding-bottom: 12px;
		}

		.wordmark {
			gap: 12px;
		}

		.wordmark-main {
			font-size: 25px;
		}

		.wordmark-sub {
			font-size: 12px;
		}
	}
</style>

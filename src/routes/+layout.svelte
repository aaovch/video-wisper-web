<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import SearchBoxLazy from '$lib/components/SearchBoxLazy.svelte';
	import VisitCounter from '$lib/components/VisitCounter.svelte';
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

	let progressEl = $state<HTMLDivElement | null>(null);
	let progressRaf = 0;

	function updateProgress() {
		if (!progressEl) return;
		if (progressRaf) return;
		progressRaf = requestAnimationFrame(() => {
			progressRaf = 0;
			const doc = document.documentElement;
			const max = doc.scrollHeight - doc.clientHeight;
			const p = max > 0 ? Math.min(1, doc.scrollTop / max) : 0;
			progressEl!.style.transform = `scaleX(${p})`;
		});
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

<div class="progress" bind:this={progressEl} aria-hidden="true"></div>

<div class="sheet">
	<header class="masthead">
		<div class="container masthead-inner">
			<a class="wordmark" href="{base}/">
				<span class="wordmark-main">{SITE_NAME}</span>
				<span class="wordmark-sub label">{SITE_TAGLINE}</span>
			</a>

			<SearchBoxLazy />
		</div>
		<hr class="rule" />
	</header>

	<main>
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

	.sheet {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
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

	.wordmark {
		display: flex;
		flex-direction: column;
		gap: 3px;
		color: var(--ink);
		flex-shrink: 0;
	}

	.wordmark-main {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 22px;
		letter-spacing: -0.02em;
		line-height: 1;
	}

	.wordmark-sub {
		font-size: 10px;
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

	@media (max-width: 900px) {
		.masthead-inner {
			flex-wrap: wrap;
			align-items: flex-start;
		}

		.wordmark-main {
			font-size: 20px;
		}
	}
</style>

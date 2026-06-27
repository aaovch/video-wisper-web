<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import VisitCounter from '$lib/components/VisitCounter.svelte';
	import { initPrerenderedReveals } from '$lib/attachments';
	import { SITE_NAME, SITE_TAGLINE } from '$lib/site';
	import { trackPageVisit } from '$lib/visit-tracker';
	import { onMount, tick } from 'svelte';

	let { children } = $props();

	let progress = $state(0);

	function updateProgress() {
		const doc = document.documentElement;
		const max = doc.scrollHeight - doc.clientHeight;
		progress = max > 0 ? Math.min(1, doc.scrollTop / max) : 0;
	}

	onMount(async () => {
		await tick();
		initPrerenderedReveals();
	});

	afterNavigate(async () => {
		await tick();
		initPrerenderedReveals();
		void trackPageVisit(page.url.pathname);
	});
</script>

<svelte:window onscroll={updateProgress} onresize={updateProgress} />

<div class="progress" style:--p={progress} aria-hidden="true"></div>

<div class="sheet">
	<header class="masthead">
		<div class="container masthead-inner">
			<a class="wordmark" href="{base}/">
				<span class="wordmark-main">{SITE_NAME}</span>
				<span class="wordmark-sub label">{SITE_TAGLINE}</span>
			</a>

			<SearchBox />
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
		transform: scaleX(var(--p, 0));
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

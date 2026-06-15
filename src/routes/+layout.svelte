<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	import SearchBox from '$lib/components/SearchBox.svelte';

	let { children } = $props();

	let progress = $state(0);

	function updateProgress() {
		const doc = document.documentElement;
		const max = doc.scrollHeight - doc.clientHeight;
		progress = max > 0 ? Math.min(1, doc.scrollTop / max) : 0;
	}
</script>

<svelte:window onscroll={updateProgress} onresize={updateProgress} />

<div class="progress" style:--p={progress} aria-hidden="true"></div>

<div class="sheet">
	<header class="masthead">
		<div class="container masthead-inner">
			<a class="wordmark" href="{base}/">
				<span class="wordmark-main">Video Wisper</span>
				<span class="wordmark-sub label">архив транскрипций</span>
			</a>

			<SearchBox />

			<nav class="nav">
				<a href="{base}/">Указатель</a>
				<span class="nav-dot" aria-hidden="true">·</span>
				<a href="https://github.com/aaovch" target="_blank" rel="noopener noreferrer">GitHub</a>
			</nav>
		</div>
		<hr class="rule" />
	</header>

	<main>
		{@render children()}
	</main>

	<footer class="colophon">
		<hr class="rule" />
		<div class="container colophon-inner">
			<p class="label">Video Wisper · Whisper Turbo + смысловая LLM-разметка</p>
			<p class="label">собрано на SvelteKit · {new Date().getFullYear()}</p>
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
		justify-content: space-between;
		gap: 16px;
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

	.nav {
		display: flex;
		align-items: center;
		gap: 14px;
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.nav a {
		color: var(--ink-soft);
		padding-bottom: 2px;
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s ease;
	}

	.nav a:hover {
		border-color: var(--accent);
		color: var(--ink);
	}

	.nav-dot {
		color: var(--line-strong);
	}

	.colophon {
		margin-top: 80px;
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

<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';

	let { children } = $props();
</script>

<div class="page">
	<header class="site-header">
		<div class="container header-inner">
			<a class="brand" href="{base}/">
				<span class="brand-mark" aria-hidden="true">▶</span>
				<span class="brand-text">Video&nbsp;Wisper</span>
			</a>
			<nav class="site-nav">
				<a href="{base}/">Отчёты</a>
				<a
					href="https://github.com/aaovch"
					target="_blank"
					rel="noopener noreferrer">GitHub</a
				>
			</nav>
		</div>
	</header>

	<main>
		{@render children()}
	</main>

	<footer class="site-footer">
		<div class="container">
			<p>
				Сгенерировано из транскрипций <span class="mono">Video Wisper</span> — Whisper Turbo +
				смысловая LLM-разметка.
			</p>
		</div>
	</footer>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	main {
		flex: 1;
	}

	.site-header {
		position: sticky;
		top: 0;
		z-index: 20;
		backdrop-filter: blur(12px);
		background: rgba(11, 15, 23, 0.72);
		border-bottom: 1px solid var(--border-soft);
	}

	.header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 60px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-weight: 700;
		font-size: 17px;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	.brand:hover {
		text-decoration: none;
	}

	.brand-mark {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 8px;
		font-size: 12px;
		color: var(--bg);
		background: linear-gradient(135deg, var(--accent), var(--accent-2));
	}

	.site-nav {
		display: flex;
		gap: 22px;
		font-size: 15px;
	}

	.site-nav a {
		color: var(--text-muted);
	}

	.site-nav a:hover {
		color: var(--text);
		text-decoration: none;
	}

	.site-footer {
		border-top: 1px solid var(--border-soft);
		padding: 28px 0;
		margin-top: 64px;
		color: var(--text-dim);
		font-size: 14px;
	}

	.site-footer p {
		margin: 0;
	}
</style>

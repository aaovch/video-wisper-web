<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — Video Wisper</title>
</svelte:head>

<section class="container err">
	<p class="code">{page.status}</p>
	<h1>{page.error?.message ?? 'Страница не найдена'}</h1>
	<a class="label" href="{base}/">← Вернуться к указателю</a>
</section>

<style>
	.err {
		padding: 110px 28px;
		text-align: center;
	}

	.code {
		font-family: var(--font-display);
		font-size: clamp(72px, 16vw, 150px);
		font-weight: 500;
		line-height: 0.9;
		color: var(--accent);
		margin: 0;
	}

	h1 {
		font-size: 28px;
		font-weight: 500;
		margin: 8px 0 28px;
	}

	.err a {
		color: var(--ink-soft);
		border-bottom: 1px solid var(--accent);
		padding-bottom: 2px;
	}
</style>

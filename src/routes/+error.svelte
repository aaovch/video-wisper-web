<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — Video Wisper</title>
</svelte:head>

<section class="container err">
	<p class="code mono">{page.status}</p>
	<h1>{page.error?.message ?? 'Что-то пошло не так'}</h1>
	<a href="{base}/">← На главную</a>
</section>

<style>
	.err {
		padding: 96px 0;
		text-align: center;
	}

	.code {
		font-size: 56px;
		color: var(--accent);
		margin: 0;
	}

	h1 {
		margin: 8px 0 24px;
		font-size: 24px;
	}
</style>

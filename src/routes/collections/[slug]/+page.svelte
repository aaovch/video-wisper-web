<script lang="ts">
	import { base } from '$app/paths';
	import ReportCard from '$lib/components/ReportCard.svelte';
	import { reveal } from '$lib/attachments';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const collection = $derived(data.collection);
	const reports = $derived(data.reports);
	const totalChapters = $derived(reports.reduce((acc, r) => acc + r.chapters.length, 0));
</script>

<svelte:head>
	<title>{collection.title} — Video Wisper</title>
	<meta name="description" content={collection.subtitle} />
</svelte:head>

<section class="container head-wrap reveal" {@attach reveal()}>
	<a class="back label" href="{base}/">← Все коллекции</a>
	<h1>{collection.title}</h1>
	<p class="subtitle">{collection.subtitle}</p>
	<p class="meta label">{reports.length} видео · {totalChapters} блоков</p>
</section>

<section class="container index">
	<hr class="rule" />
	<ul class="index-list">
		{#each reports as report, i (report.slug)}
			<li class="reveal" {@attach reveal({ delay: i * 80 })}>
				<ReportCard {report} index={i + 1} />
			</li>
		{/each}
	</ul>
</section>

<style>
	.head-wrap {
		padding-top: 24px;
	}

	.back {
		display: inline-block;
		margin-bottom: 18px;
		color: var(--ink-soft);
		border-bottom: 1px solid transparent;
		padding-bottom: 2px;
		transition: border-color 0.2s ease;
	}

	.back:hover {
		border-color: var(--accent);
	}

	.head-wrap h1 {
		font-size: clamp(30px, 4.6vw, 56px);
		font-weight: 500;
		margin: 0 0 12px;
		max-width: 20ch;
		line-height: 1.05;
	}

	.subtitle {
		font-size: clamp(17px, 1.8vw, 21px);
		color: var(--ink-soft);
		max-width: 54ch;
		margin: 0 0 12px;
		line-height: 1.45;
	}

	.meta {
		margin: 0 0 22px;
	}

	.index {
		padding-top: 12px;
	}

	.index-list {
		list-style: none;
		margin: 18px 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 20px;
	}
</style>

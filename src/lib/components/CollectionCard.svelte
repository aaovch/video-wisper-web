<script lang="ts">
	import { base } from '$app/paths';
	import { collectionReports, collectionStats, type Collection } from '$lib/data/collections';

	let { collection, index }: { collection: Collection; index: number } = $props();

	const reports = $derived(collectionReports(collection));
	const stats = $derived(collectionStats(collection));
	const preview = $derived(reports.slice(0, 3));
</script>

<a class="collection" href="{base}/collections/{collection.slug}/">
	<div class="head">
		<span class="numeral" aria-hidden="true">{String(index).padStart(2, '0')}</span>
		<span class="count mono">{stats.videos} видео</span>
	</div>

	<h3 class="title">{collection.title}</h3>
	<p class="subtitle">{collection.subtitle}</p>

	<ul class="items">
		{#each preview as r (r.slug)}
			<li>{r.title}</li>
		{/each}
		{#if reports.length > preview.length}
			<li class="more">ещё {reports.length - preview.length}…</li>
		{/if}
	</ul>

	<span class="open">Открыть дашборд <span class="arrow" aria-hidden="true">→</span></span>
</a>

<style>
	.collection {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 22px 24px 20px;
		background: var(--paper-2);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		color: var(--ink);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
		transition:
			border-color 0.25s ease,
			transform 0.25s ease;
	}

	.collection:hover {
		border-color: var(--line-strong);
		transform: translateY(-2px);
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 14px;
		margin-bottom: 8px;
	}

	.numeral {
		font-family: var(--font-display);
		font-size: 30px;
		font-weight: 400;
		line-height: 1;
		color: var(--line-strong);
		transition: color 0.25s ease;
		font-feature-settings: 'ss01';
	}

	.collection:hover .numeral {
		color: var(--accent);
	}

	.count {
		font-size: 12px;
		color: var(--ink-faint);
		white-space: nowrap;
	}

	.title {
		font-size: clamp(22px, 2.4vw, 28px);
		font-weight: 500;
		margin: 0 0 8px;
		line-height: 1.1;
	}

	.subtitle {
		font-size: 16.5px;
		color: var(--ink-soft);
		margin: 0 0 16px;
		line-height: 1.45;
	}

	.items {
		list-style: none;
		margin: 0 0 18px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
		flex: 1;
	}

	.items li {
		font-size: 15px;
		color: var(--ink-soft);
		padding: 7px 0;
		border-top: 1px solid var(--line);
	}

	.items li.more {
		color: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	.open {
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--accent);
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.arrow {
		transition: transform 0.25s ease;
	}

	.collection:hover .arrow {
		transform: translateX(5px);
	}
</style>

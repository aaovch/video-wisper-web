<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import ReportCard from '$lib/components/ReportCard.svelte';
	import Lock from '$lib/components/Lock.svelte';
	import VisitCounter from '$lib/components/VisitCounter.svelte';
	import { reveal } from '$lib/attachments';
	import { lock } from '$lib/lock.svelte';
	import { SITE_NAME } from '$lib/site';
	import { prefetchReportCounts } from '$lib/visit-counter.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const collection = $derived(data.collection);
	const reports = $derived(data.reports);
	const locked = $derived(Boolean(collection.password) && !lock.isUnlocked(collection.slug));

	onMount(() => {
		prefetchReportCounts(collection.items);
	});
</script>

<svelte:head>
	<title>{collection.title} — {SITE_NAME}</title>
	<meta name="description" content={collection.description ?? collection.subtitle} />
</svelte:head>

{#if locked}
	<Lock
		targets={[collection]}
		title={collection.title}
		subtitle="Коллекция закрыта. Введите пароль, чтобы открыть доступ."
	/>
{:else}
<section class="container head-wrap reveal" {@attach reveal()}>
	<a class="back label" href="{base}/">← Все коллекции</a>
	<h1>{collection.title}</h1>
	<p class="subtitle">{collection.subtitle}</p>
	{#if collection.description}
		<p class="description">{collection.description}</p>
	{/if}
	<p class="views label">
		<VisitCounter target={{ kind: 'reports-sum', slugs: collection.items }} suffix="просмотров" />
	</p>
</section>

{#if collection.analysis}
	<section class="container analysis reveal" {@attach reveal()}>
		<hr class="rule" />
		<div class="analysis-inner">
			<h2>Что заявляли — и как вышло</h2>
			<p class="lede">{collection.analysis.lede}</p>
			<ol class="findings">
				{#each collection.analysis.findings as finding, i (i)}
					<li class="finding reveal" {@attach reveal({ delay: i * 60 })}>
						<span class="finding-num" aria-hidden="true">{i + 1}</span>
						<div class="finding-part">
							<span class="finding-tag">Заявляли</span>
							<p class="claim">{finding.claim}</p>
						</div>
						<div class="finding-part finding-part--reality">
							<span class="finding-tag finding-tag--reality">В боях</span>
							<p class="reality">{finding.reality}</p>
						</div>
					</li>
				{/each}
			</ol>
			<p class="outcome">{collection.analysis.outcome}</p>
		</div>
	</section>
{/if}

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
{/if}

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

	.description {
		font-size: clamp(16px, 1.5vw, 18px);
		color: var(--ink);
		max-width: 60ch;
		margin: 0 0 16px;
		line-height: 1.65;
	}

	.views {
		margin: 0;
		color: var(--ink-faint);
	}

	.analysis {
		padding-top: 4px;
	}

	.analysis-inner {
		max-width: 1080px;
	}

	.analysis h2 {
		font-size: clamp(22px, 2.6vw, 30px);
		font-weight: 500;
		margin: 26px 0 14px;
		line-height: 1.1;
	}

	.analysis .lede {
		font-size: clamp(16px, 1.5vw, 18px);
		color: var(--ink);
		max-width: 64ch;
		margin: 0 0 30px;
		line-height: 1.65;
	}

	.findings {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 22px 20px;
	}

	.finding {
		position: relative;
		display: flex;
		flex-direction: column;
		padding: 24px 22px 18px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--paper-2);
		box-shadow: var(--shadow);
	}

	.finding-num {
		position: absolute;
		top: -14px;
		left: 20px;
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		font-family: var(--font-mono);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		color: var(--paper);
		background: var(--accent);
		border-radius: 50%;
		box-shadow: var(--shadow);
	}

	.finding-part {
		margin: 0;
	}

	.finding-part--reality {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--line-strong);
	}

	.finding-tag {
		display: inline-block;
		margin: 0 0 9px;
		padding: 2px 9px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		border-radius: 999px;
		color: var(--ink-faint);
		border: 1px solid var(--line-strong);
	}

	.finding-tag--reality {
		color: var(--accent);
		border-color: var(--accent);
	}

	.claim,
	.reality {
		margin: 0;
		line-height: 1.6;
	}

	.claim {
		font-size: clamp(15px, 1.35vw, 17px);
		font-weight: 500;
		color: var(--ink);
	}

	.reality {
		font-size: clamp(14px, 1.25vw, 15.5px);
		color: var(--ink-soft);
	}

	.outcome {
		font-size: clamp(15px, 1.5vw, 18px);
		color: var(--ink);
		max-width: 70ch;
		margin: 30px 0 0;
		padding-top: 20px;
		border-top: 2px solid var(--accent);
		line-height: 1.65;
	}

	@media (max-width: 760px) {
		.findings {
			grid-template-columns: 1fr;
			gap: 26px 0;
		}

		.finding {
			padding: 22px 18px 16px;
		}
	}

	.index {
		padding-top: 12px;
	}

	.index-list {
		list-style: none;
		margin: 18px 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 20px;
	}

	@media (max-width: 960px) {
		.index-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 620px) {
		.index-list {
			grid-template-columns: 1fr;
		}
	}
</style>

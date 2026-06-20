<script lang="ts">
	import { base } from '$app/paths';
	import ReportCard from '$lib/components/ReportCard.svelte';
	import Lock from '$lib/components/Lock.svelte';
	import { reveal } from '$lib/attachments';
	import { lock } from '$lib/lock.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const collection = $derived(data.collection);
	const reports = $derived(data.reports);
	const totalChapters = $derived(reports.reduce((acc, r) => acc + r.chapters.length, 0));
	const totalDurationMin = $derived(
		Math.round(reports.reduce((acc, r) => acc + (r.duration ?? 0), 0) / 60)
	);
	const locked = $derived(Boolean(collection.password) && !lock.isUnlocked(collection.slug));
</script>

<svelte:head>
	<title>{collection.title} — Video Wisper</title>
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
	<p class="meta label">
		{#if collection.password}<span class="unlocked">🔓 Открыто паролем</span> ·{' '}{/if}{reports.length} видео
		· ~{totalDurationMin} мин · {totalChapters} блоков
	</p>
</section>

{#if collection.analysis}
	<section class="container analysis reveal" {@attach reveal()}>
		<hr class="rule" />
		<h2>Что заявляли — и как вышло</h2>
		<p class="lede">{collection.analysis.lede}</p>
		<ol class="findings">
			{#each collection.analysis.findings as finding, i (i)}
				<li class="reveal" {@attach reveal({ delay: i * 60 })}>
					<p class="claim"><span class="finding-tag">Заявляли</span>{finding.claim}</p>
					<p class="reality">
						<span class="finding-tag finding-tag--reality">В боях</span>{finding.reality}
					</p>
				</li>
			{/each}
		</ol>
		<p class="outcome">{collection.analysis.outcome}</p>
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
		font-size: clamp(16px, 1.6vw, 19px);
		color: var(--ink);
		max-width: 62ch;
		margin: 0 0 16px;
		line-height: 1.55;
	}

	.unlocked {
		color: var(--accent);
	}

	.meta {
		margin: 0 0 22px;
	}

	.analysis {
		padding-top: 4px;
	}

	.analysis h2 {
		font-size: clamp(22px, 2.6vw, 30px);
		font-weight: 500;
		margin: 22px 0 14px;
		line-height: 1.1;
	}

	.analysis .lede {
		font-size: clamp(16px, 1.6vw, 19px);
		color: var(--ink);
		max-width: 64ch;
		margin: 0 0 26px;
		line-height: 1.55;
	}

	.findings {
		list-style: none;
		counter-reset: finding;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 16px;
	}

	.findings li {
		counter-increment: finding;
		position: relative;
		padding: 18px 20px 18px 56px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--paper-2);
		box-shadow: var(--shadow);
	}

	.findings li::before {
		content: counter(finding);
		position: absolute;
		left: 18px;
		top: 18px;
		width: 26px;
		height: 26px;
		display: grid;
		place-items: center;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		color: var(--accent);
		border: 1px solid var(--accent);
		border-radius: 50%;
	}

	.findings .claim,
	.findings .reality {
		margin: 0;
		max-width: 70ch;
		line-height: 1.55;
	}

	.findings .claim {
		font-size: clamp(15px, 1.5vw, 18px);
		color: var(--ink);
		margin-bottom: 10px;
	}

	.findings .reality {
		font-size: clamp(14px, 1.45vw, 16px);
		color: var(--ink-soft);
	}

	.finding-tag {
		display: inline-block;
		margin-right: 9px;
		padding: 2px 9px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		vertical-align: middle;
		border-radius: 999px;
		color: var(--ink-faint);
		border: 1px solid var(--line-strong);
	}

	.finding-tag--reality {
		color: var(--accent);
		border-color: var(--accent);
	}

	.outcome {
		font-size: clamp(15px, 1.55vw, 18px);
		color: var(--ink);
		max-width: 66ch;
		margin: 26px 0 0;
		padding-top: 18px;
		border-top: 2px solid var(--accent);
		line-height: 1.55;
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

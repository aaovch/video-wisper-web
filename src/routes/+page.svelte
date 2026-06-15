<script lang="ts">
	import ReportCard from '$lib/components/ReportCard.svelte';
	import { reports } from '$lib/data';

	const totalChapters = reports.reduce((acc, r) => acc + r.chapters.length, 0);
</script>

<svelte:head>
	<title>Video Wisper — отчёты по видео</title>
	<meta
		name="description"
		content="Смысловые блоки, тезисы и расшифровки видео, сгенерированные Video Wisper."
	/>
</svelte:head>

<section class="hero">
	<div class="container">
		<p class="kicker">Video Wisper</p>
		<h1>Видео, разобранные по смыслу</h1>
		<p class="lede">
			Транскрипция через Whisper Turbo, смысловая LLM-разметка на блоки, тезисы и саммари.
			Каждый отчёт — это карта видео: что, где и зачем.
		</p>
		<div class="stats">
			<div class="stat">
				<span class="stat-num">{reports.length}</span>
				<span class="stat-label">отчёта</span>
			</div>
			<div class="stat">
				<span class="stat-num">{totalChapters}</span>
				<span class="stat-label">смысловых блоков</span>
			</div>
		</div>
	</div>
</section>

<section class="container">
	<div class="grid">
		{#each reports as report (report.slug)}
			<ReportCard {report} />
		{/each}
	</div>
</section>

<style>
	.hero {
		padding: 72px 0 48px;
	}

	.kicker {
		margin: 0 0 12px;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.hero h1 {
		margin: 0 0 16px;
		font-size: clamp(34px, 6vw, 52px);
		max-width: 16ch;
	}

	.lede {
		margin: 0;
		max-width: 56ch;
		font-size: 18px;
		color: var(--text-muted);
	}

	.stats {
		display: flex;
		gap: 36px;
		margin-top: 36px;
	}

	.stat {
		display: flex;
		flex-direction: column;
	}

	.stat-num {
		font-size: 32px;
		font-weight: 700;
		color: var(--text);
	}

	.stat-label {
		font-size: 14px;
		color: var(--text-dim);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
		gap: 20px;
	}
</style>

<script lang="ts">
	import ReportCard from '$lib/components/ReportCard.svelte';
	import { reveal } from '$lib/attachments';
	import { reports } from '$lib/data';

	const totalChapters = reports.reduce((acc, r) => acc + r.chapters.length, 0);
</script>

<svelte:head>
	<title>Video Wisper — архив транскрипций</title>
	<meta
		name="description"
		content="Видео, разобранные по смыслу: смысловые блоки, тезисы и расшифровки, сгенерированные Video Wisper."
	/>
</svelte:head>

<section class="hero container">
	<p class="label reveal" {@attach reveal()}>Том I · разбор по смыслу</p>
	<h1 class="reveal" {@attach reveal({ delay: 80 })}>
		Видео,<br /><em>разобранные</em> по смыслу
	</h1>
	<div class="hero-foot reveal" {@attach reveal({ delay: 160 })}>
		<p class="lede">
			Речь распознаётся через Whisper&nbsp;Turbo, затем размечается на смысловые блоки с тезисами и
			саммари. Каждая запись — это карта: что, где и зачем сказано.
		</p>
		<dl class="ledger">
			<div>
				<dt class="label">записей</dt>
				<dd>{String(reports.length).padStart(2, '0')}</dd>
			</div>
			<div>
				<dt class="label">блоков</dt>
				<dd>{totalChapters}</dd>
			</div>
		</dl>
	</div>
</section>

<section class="container index">
	<div class="index-head">
		<h2 class="label">Указатель записей</h2>
		<span class="label">{String(reports.length).padStart(2, '0')} / {String(reports.length).padStart(2, '0')}</span>
	</div>
	<hr class="rule" />
	<ul class="index-list">
		{#each reports as report, i (report.slug)}
			<li class="reveal" {@attach reveal({ delay: i * 90 })}>
				<ReportCard {report} index={i + 1} />
			</li>
		{/each}
	</ul>
</section>

<style>
	.hero {
		padding: 64px 28px 40px;
	}

	.hero h1 {
		font-size: clamp(44px, 9vw, 104px);
		font-weight: 500;
		margin: 14px 0 0;
		max-width: 14ch;
	}

	.hero h1 em {
		font-style: italic;
		font-weight: 400;
		color: var(--accent);
	}

	.hero-foot {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 48px;
		align-items: end;
		margin-top: 36px;
	}

	.lede {
		max-width: 46ch;
		font-size: 20px;
		color: var(--ink-soft);
		margin: 0;
	}

	.ledger {
		display: flex;
		gap: 36px;
		margin: 0;
	}

	.ledger dt {
		margin-bottom: 2px;
	}

	.ledger dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: 44px;
		font-weight: 500;
		line-height: 1;
		color: var(--ink);
	}

	.index {
		padding-top: 40px;
	}

	.index-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 14px;
	}

	.index-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	@media (max-width: 720px) {
		.hero-foot {
			grid-template-columns: 1fr;
			gap: 28px;
		}

		.ledger dd {
			font-size: 36px;
		}
	}
</style>

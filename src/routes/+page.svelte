<script lang="ts">
	import CollectionCard from '$lib/components/CollectionCard.svelte';
	import { reveal } from '$lib/attachments';
	import { reports } from '$lib/data';
	import { collections } from '$lib/data/collections';
</script>

<svelte:head>
	<title>Video Wisper — архив транскрипций</title>
	<meta
		name="description"
		content="Видео, разобранные по смыслу: тематические коллекции, смысловые блоки, тезисы и расшифровки."
	/>
</svelte:head>

<section class="hero container">
	<h1 class="reveal" {@attach reveal()}>
		Видео,<br /><em>разобранные</em> по смыслу
	</h1>
	<div class="hero-foot reveal" {@attach reveal({ delay: 100 })}>
		<p class="lede">
			Тематические коллекции видео, разобранных на смысловые блоки с тезисами и таймкодами.
		</p>
		<dl class="ledger">
			<div>
				<dt class="label">коллекций</dt>
				<dd>{String(collections.length).padStart(2, '0')}</dd>
			</div>
			<div>
				<dt class="label">записей</dt>
				<dd>{String(reports.length).padStart(2, '0')}</dd>
			</div>
		</dl>
	</div>
</section>

<section class="container index">
	<h2 class="label index-head">Коллекции</h2>
	<hr class="rule" />
	<ul class="grid">
		{#each collections as collection, i (collection.slug)}
			<li class="reveal" {@attach reveal({ delay: i * 90 })}>
				<CollectionCard {collection} index={i + 1} />
			</li>
		{/each}
	</ul>
</section>

<style>
	.hero {
		padding: 40px 28px 8px;
	}

	.hero h1 {
		font-size: clamp(38px, 5.5vw, 64px);
		font-weight: 500;
		margin: 10px 0 0;
		max-width: 18ch;
		line-height: 1.04;
	}

	.hero h1 em {
		font-style: italic;
		font-weight: 400;
		color: var(--accent);
	}

	.hero-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 24px 56px;
		align-items: flex-end;
		margin-top: 24px;
	}

	.lede {
		max-width: 44ch;
		font-size: 18px;
		color: var(--ink-soft);
		margin: 0;
	}

	.ledger {
		display: flex;
		gap: 32px;
		margin: 0;
	}

	.ledger dt {
		margin-bottom: 2px;
	}

	.ledger dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: 34px;
		font-weight: 500;
		line-height: 1;
		color: var(--ink);
	}

	.index {
		padding-top: 28px;
	}

	.index-head {
		display: block;
		margin: 0 0 14px;
	}

	.grid {
		list-style: none;
		margin: 18px 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 20px;
	}

	@media (max-width: 720px) {
		.hero-foot {
			grid-template-columns: 1fr;
			gap: 28px;
		}

		.ledger {
			gap: 28px;
		}

		.ledger dd {
			font-size: 36px;
		}
	}
</style>

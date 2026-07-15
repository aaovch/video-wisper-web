<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import LockKey from 'phosphor-svelte/lib/LockKey';
	import LockKeyOpen from 'phosphor-svelte/lib/LockKeyOpen';
	import { collectionStats, type Collection } from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';

	let { collection }: { collection: Collection } = $props();

	const stats = $derived(collectionStats(collection));
	const locked = $derived(Boolean(collection.password) && !lock.isUnlocked(collection.slug));
	const href = $derived(`${base}/collections/${collection.slug}/`);
	const facets = $derived([
		...(collection.facets?.authors ?? []),
		...(collection.facets?.places ?? []),
		...(collection.facets?.weapons ?? [])
	].slice(0, 3));

	let value = $state('');
	let failed = $state(false);

	function submit(e: Event) {
		e.preventDefault();
		if (lock.tryUnlock([collection], value.trim())) {
			value = '';
			failed = false;
			goto(href);
		} else {
			failed = true;
		}
	}
</script>

{#snippet content()}
	<div class="copy">
		<div class="title-line">
			<h3>{collection.title}</h3>
			{#if collection.password}
				<span class="lock-state" aria-label={locked ? 'Закрытая коллекция' : 'Коллекция открыта'}>
					{#if locked}<LockKey size={16} weight="regular" />{:else}<LockKeyOpen size={16} weight="regular" />{/if}
				</span>
			{/if}
		</div>
		<p class="subtitle">{collection.subtitle}</p>
		{#if facets.length}
			<p class="facets label">{facets.join(' · ')}</p>
		{/if}
	</div>
	<div class="meta">
		<span>{stats.videos} {stats.videos === 1 ? 'материал' : stats.videos < 5 ? 'материала' : 'материалов'}</span>
		{#if !locked}<span class="arrow"><ArrowRight size={22} weight="thin" aria-hidden="true" /></span>{/if}
	</div>
{/snippet}

{#if locked}
	<div class="collection collection--locked">
		{@render content()}
		<form class="lock-form" onsubmit={submit}>
			<input
				type="password"
				bind:value
				placeholder="Пароль"
				autocomplete="off"
				aria-label="Пароль для «{collection.title}»"
				aria-invalid={failed}
				oninput={() => (failed = false)}
			/>
			<button type="submit">Открыть</button>
		</form>
		{#if failed}
			<p class="message error" role="alert">Неверный пароль</p>
		{:else if collection.passwordHint}
			<p class="message">{collection.passwordHint}</p>
		{/if}
	</div>
{:else}
	<a class="collection" href={href}>
		{@render content()}
	</a>
{/if}

<style>
	.collection {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 18px;
		align-items: start;
		min-height: 132px;
		padding: 22px 14px 22px 0;
		border-top: 1px solid var(--line-strong);
		color: var(--ink);
		transition:
			color 0.2s ease,
			background 0.2s ease,
			padding 0.2s ease;
	}

	a.collection:hover {
		padding-left: 14px;
		background: color-mix(in srgb, var(--paper-2) 70%, transparent);
		color: var(--accent-ink);
	}

	.copy {
		min-width: 0;
	}

	.title-line {
		display: flex;
		align-items: center;
		gap: 9px;
	}

	h3 {
		font-size: clamp(23px, 2.3vw, 32px);
		line-height: 1.08;
	}

	.lock-state {
		display: inline-flex;
		color: var(--accent);
	}

	.subtitle {
		max-width: 50ch;
		margin: 8px 0 0;
		font-size: 16px;
		line-height: 1.45;
		color: var(--ink-soft);
	}

	.facets {
		margin: 12px 0 0;
		font-size: 10px;
		letter-spacing: 0.13em;
		line-height: 1.5;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-top: 6px;
		font-size: 14px;
		color: var(--ink-faint);
		white-space: nowrap;
	}

	.arrow {
		color: var(--accent);
		transition: transform 0.2s ease;
	}

	a.collection:hover .arrow {
		transform: translateX(5px);
	}

	.collection--locked {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	.lock-form {
		grid-column: 1 / -1;
		display: flex;
		gap: 8px;
		max-width: 360px;
	}

	.lock-form input {
		min-width: 0;
		flex: 1;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--paper);
		padding: 8px 10px;
		font: inherit;
		font-size: 15px;
		color: var(--ink);
	}

	.lock-form input[aria-invalid='true'] {
		border-color: var(--accent);
	}

	.lock-form button {
		border: 1px solid var(--accent);
		border-radius: var(--radius-sm);
		background: var(--accent);
		padding: 0 15px;
		font: inherit;
		font-size: 14px;
		color: var(--paper);
		cursor: pointer;
	}

	.message {
		grid-column: 1 / -1;
		margin: -6px 0 0;
		font-size: 13px;
		line-height: 1.4;
		color: var(--ink-faint);
	}

	.message.error {
		color: var(--accent);
	}

	@media (max-width: 620px) {
		.collection,
		.collection--locked {
			grid-template-columns: 1fr;
			gap: 10px;
			padding-right: 0;
		}

		a.collection:hover {
			padding-left: 10px;
		}

		.meta {
			justify-content: space-between;
			padding-top: 0;
		}
	}
</style>

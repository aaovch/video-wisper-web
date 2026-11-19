<script lang="ts">
	import { Button } from '@ui-sdk/svelte/button';
	import { Input } from '@ui-sdk/svelte/input';
	import { communityArchive } from '$lib/site';
	import { accessibleRecordingCount } from '$lib/data/collections';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import LockKey from 'phosphor-svelte/lib/LockKey';
	import LockKeyOpen from 'phosphor-svelte/lib/LockKeyOpen';
	import {
		canEnterCollection,
		collectionGate,
		reportGate,
		collectionMasterTarget,
		collectionStats,
		hasFullCollectionAccess,
		type Collection
	} from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';

	let { collection, onUnlock }: {
		collection: Collection;
		onUnlock?: () => void;
	} = $props();

	const stats = $derived(collectionStats(collection));
	const materialForm = $derived(new Intl.PluralRules('ru').select(stats.videos));
	const openCount = $derived(communityArchive ? accessibleRecordingCount(collection.items, lock.unlocked) : stats.videos);
	const gate = $derived(collectionGate(collection));
	const master = $derived(collectionMasterTarget(collection));
	const fullAccess = $derived(hasFullCollectionAccess(collection, lock.unlocked));
	const locked = $derived(!canEnterCollection(collection, lock.unlocked));
	const unlockedItems = $derived(communityArchive && lock.unlocked.length > 0 &&
		collection.items.some(slug => reportGate(slug).some(target => lock.isUnlocked(target))));
	const partiallyUnlocked = $derived(Boolean(master) && !locked && !fullAccess);
	const href = $derived(`${base}/collections/${collection.slug}/`);
	const facets = $derived([
		...(collection.facets?.authors ?? []).filter(author => author !== collection.title),
		...(collection.facets?.places ?? []),
		...(collection.facets?.weapons ?? [])
	].slice(0, onUnlock ? undefined : 3));

	let value = $state('');
	let failed = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		if (await lock.tryUnlock(gate, value.trim(), href)) {
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
			<h3>{#if onUnlock}<Button onclick={onUnlock}>
				{#snippet render({ props })}
					<button {...props} class="title-button">{collection.title}</button>
				{/snippet}
			</Button>{:else}{collection.title}{/if}</h3>
			{#if gate.length || unlockedItems}
				<span class="lock-state" role="img" aria-label={locked ? 'Закрытая коллекция' : openCount < stats.videos || partiallyUnlocked ? 'Полные материалы по ключу' : 'Доступ открыт'}>
					{#if locked || openCount === 0}<LockKey size={16} weight="regular" />{:else}<LockKeyOpen size={16} weight="regular" />{/if}
				</span>
			{/if}
		</div>
		{#if collection.cardSubtitle ?? collection.subtitle}<p class="subtitle">{collection.cardSubtitle ?? collection.subtitle}</p>{/if}
		{#if facets.length}
			<p class="facets label">{facets.join(' · ')}</p>
		{/if}
	</div>
	<div class="meta">
		<span>{stats.videos} {materialForm === 'one' ? 'материал' : materialForm === 'few' ? 'материала' : 'материалов'}</span>
		{#if !onUnlock && communityArchive && openCount > 0 && openCount < stats.videos}<span>Открыто {openCount} из {stats.videos}</span>{/if}
		{#if partiallyUnlocked && !communityArchive}<span class="partial label">частичный доступ</span>{/if}
		{#if !locked}<span class="arrow"><ArrowRight size={22} weight="thin" aria-hidden="true" /></span>{/if}
	</div>
{/snippet}

{#if onUnlock}
	<article class="collection compact">
		<div>
			{@render content()}
			<Button onclick={onUnlock}>
				{#snippet render({ props })}
					<button {...props} class="access-link">Открыть доступ <ArrowRight size={15} aria-hidden="true" /></button>
				{/snippet}
			</Button>
		</div>
	</article>
{:else if locked}
	<div class="collection collection--locked">
		{@render content()}
		<form class="lock-form" onsubmit={submit}>
			<Input type="text" bind:value placeholder="Ключ доступа" autocomplete="off" autocapitalize="none" spellcheck={false} aria-label="Ключ для «{collection.title}»" aria-invalid={failed} onValueChange={() => (failed = false)} data-agent-secret>
				{#snippet render({ props })}
					<input {...props} />
				{/snippet}
			</Input>
			<Button type="submit">
				{#snippet render({ props })}
					<button {...props}>Открыть</button>
				{/snippet}
			</Button>
		</form>
		{#if failed}
			<p class="message error" role="alert">Ключ не подошёл</p>
		{/if}
		{#each gate.filter((target) => target.passwordHint) as target (target.id)}
			<p class="message">
				{#if gate.length > 1}<span class="hint-label">{target.kind === 'master' ? 'Вся коллекция' : target.title}:</span>{/if}
				{target.passwordHint}
				{#if target.passwordContact}
					<a href={target.passwordContact.url} target="_blank" rel="noopener noreferrer">{target.passwordContact.label}</a>
				{/if}
			</p>
		{/each}
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
		font: 14px/1.45 var(--font-ui);
		text-transform: none;
		letter-spacing: normal;
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

	.partial {
		color: var(--accent);
		font-size: 13px;
		letter-spacing: 0.08em;
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

	.hint-label {
		display: block;
		color: var(--ink-soft);
	}

	@media (max-width: 1100px) {
		.collection,
		.collection--locked {
			grid-template-columns: minmax(0, 1fr);
			gap: 10px;
			padding-right: 0;
		}

		a.collection:hover {
			padding-left: 10px;
		}

		.meta {
			flex-wrap: wrap;
			justify-content: space-between;
			padding-top: 0;
		}
	}
	@media (max-width: 760px) {
		.collection { border-top: 1px solid var(--line-strong); }
	}
	.collection.compact { grid-template-columns: minmax(0,1fr); gap: 14px; padding: 16px 0; min-height: 0; }
	.compact h3 { font-size: clamp(20px, 1.9vw, 25px); }
	.compact .meta, .compact .facets, .compact .subtitle { margin-top: 5px; padding: 0; font-size: 14px; }
	.title-button { padding: 0; background: none; border: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
	.access-link { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; background: transparent; border: 0; padding: 0; color: var(--accent-ink); font: 14px/1.4 var(--font-ui); cursor: pointer; }
	.access-link:hover { text-decoration: underline; }
	.title-button:hover { color: var(--accent-ink); }
</style>

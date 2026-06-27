<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import VisitCounter from '$lib/components/VisitCounter.svelte';
	import { collectionReports, collectionStats, type Collection } from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';

	let { collection, index }: { collection: Collection; index: number } = $props();

	const reports = $derived(collectionReports(collection));
	const stats = $derived(collectionStats(collection));
	const preview = $derived(reports.slice(0, 3));
	const locked = $derived(Boolean(collection.password) && !lock.isUnlocked(collection.slug));

	const href = $derived(`${base}/collections/${collection.slug}/`);

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

{#snippet body()}
	<div class="head">
		<span class="numeral" aria-hidden="true">{String(index).padStart(2, '0')}</span>
		<div class="meta">
			<span class="count mono">
				{#if collection.password && !locked}<span class="badge open">🔓 Открыто</span> ·{' '}{:else if collection.password}<span
						class="badge">🔒</span
					>{' '}{/if}{stats.videos} видео
			</span>
			<VisitCounter
				target={{ kind: 'reports-sum', slugs: collection.items }}
				track={false}
				suffix="просмотров"
				class="views"
			/>
		</div>
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
{/snippet}

{#if locked}
	<div class="collection">
		{@render body()}
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
			<button type="submit" aria-label="Открыть">→</button>
		</form>
		{#if failed}
			<p class="err mono" role="alert">Неверный пароль</p>
		{:else if collection.passwordHint}
			<p class="hint">{collection.passwordHint}</p>
		{/if}
	</div>
{:else}
	<a class="collection" href={href}>
		{@render body()}
		<span class="open">Открыть дашборд <span class="arrow" aria-hidden="true">→</span></span>
	</a>
{/if}

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

	a.collection:hover {
		border-color: var(--line-strong);
		transform: translateY(-2px);
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 14px;
		margin-bottom: 8px;
	}

	.meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 3px;
		min-width: 0;
		text-align: right;
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

	a.collection:hover .numeral {
		color: var(--accent);
	}

	.count {
		font-size: 12px;
		color: var(--ink-faint);
	}

	:global(.views) {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-faint);
		white-space: nowrap;
	}

	.badge.open {
		color: var(--accent);
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

	a.collection:hover .arrow {
		transform: translateX(5px);
	}

	.lock-form {
		display: flex;
		gap: 8px;
	}

	.lock-form input {
		flex: 1;
		min-width: 0;
		font-family: var(--font-body);
		font-size: 15px;
		padding: 8px 10px;
		background: var(--paper);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		color: var(--ink);
	}

	.lock-form input[aria-invalid='true'] {
		border-color: var(--accent);
	}

	.lock-form button {
		flex-shrink: 0;
		width: 40px;
		font-size: 16px;
		background: var(--accent);
		color: var(--paper);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.lock-form button:hover {
		background: var(--accent-ink);
	}

	.err {
		margin: 10px 0 0;
		font-size: 11px;
		color: var(--accent);
	}

	.hint {
		margin: 10px 0 0;
		font-size: 13px;
		color: var(--ink-faint);
		line-height: 1.4;
	}
</style>

<script lang="ts">
	import { Input } from '@ui-sdk/svelte/input';
	import { Button } from '@ui-sdk/svelte/button';
	import { base } from '$app/paths';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import LockKey from 'phosphor-svelte/lib/LockKey';
	import { lock } from '$lib/lock.svelte';
	import type { AccessTarget } from '$lib/data/collections';

	let {
		targets, archiveReturn,
		embedded = false,
		title = 'Закрытая коллекция',
		subtitle = 'Введите ключ, чтобы открыть доступ.'
	}: { targets: AccessTarget[]; archiveReturn?: string; title?: string; subtitle?: string; embedded?: boolean } = $props();

	const hintTargets = $derived(targets.filter((target, i) => target.passwordHint && targets.findIndex(other =>
		other.passwordHint === target.passwordHint && other.passwordContact?.url === target.passwordContact?.url) === i));

	let value = $state('');
	let failed = $state(false);
	let busy = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		if (busy) return;
		busy = true;
		try {
		if (await lock.tryUnlock(targets, value.trim())) {
			failed = false;
			value = '';
		} else {
			failed = true;
		}
		} finally { busy = false; }
	}
</script>

<section class="gate-wrap" class:container={!embedded} class:embedded>
	{#if !embedded}
		<nav aria-label="Навигация">
			<a class="back label" href="{base}/"><ArrowLeft size={16} /> На главную</a>
			{#if archiveReturn}<a class="back label" href={archiveReturn}>К результатам поиска</a>{/if}
		</nav>
	{/if}
	<div class="gate">
		{#if !embedded}<span class="lock-mark" aria-hidden="true"><LockKey size={34} /></span>{/if}
		{#if embedded}<h2>{title}</h2>{:else}<h1>{title}</h1>{/if}
		<p class="subtitle">{subtitle}</p>
		<form onsubmit={submit}>
			<Input type="text" bind:value placeholder="Ключ доступа" required autocomplete="off" autocapitalize="none" spellcheck={false} aria-label="Ключ доступа" aria-invalid={failed} onValueChange={() => (failed = false)} data-agent-secret>
				{#snippet render({ props })}
					<input {...props} />
				{/snippet}
			</Input>
			<Button type="submit" disabled={busy}>
				{#snippet render({ props })}
					<button {...props}>{busy ? 'Проверяем…' : 'Открыть доступ'} <ArrowRight size={16} /></button>
				{/snippet}
			</Button>
		</form>
		{#if failed}
			<p class="err label" role="alert">Ключ не подошёл. Проверьте его и попробуйте ещё раз.</p>
		{/if}
		{#each hintTargets as target (target.id)}
			<p class="hint">
				{#if hintTargets.length > 1}<span class="hint-label">{target.kind === 'master' ? 'Вся коллекция' : target.title}:</span>{/if}
				{target.passwordHint}
				{#if target.passwordContact}
					<a href={target.passwordContact.url} target="_blank" rel="noopener noreferrer">{target.passwordContact.label}</a>
				{/if}
			</p>
		{/each}
	</div>
</section>

<style>
	.embedded { padding-top: 0; }
	.embedded .gate { max-width: none; margin: 32px 0 0; text-align: left; padding: 28px 24px; background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius); }
	.gate h2 { margin: 0 0 10px; font-size: clamp(23px, 3vw, 30px); line-height: 1.2; }
	@media (max-width: 520px) { form { flex-direction: column; } button { min-height: 44px; justify-content: center; } }
	.gate-wrap {
		padding-top: 24px;
	}

	nav { display: flex; flex-wrap: wrap; gap: 0 16px; }
	.back {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		margin-bottom: 18px;
		color: var(--ink-soft);
		border-bottom: 1px solid transparent;
		padding-bottom: 2px;
		transition: border-color 0.2s ease;
	}

	.back:hover {
		border-color: var(--accent);
	}

	.gate {
		max-width: 520px;
		margin: 8vh auto 0;
		text-align: center;
		padding: 38px 28px 34px;
		border-top: 1px solid var(--line-strong);
		border-bottom: 1px solid var(--line);
	}

	.lock-mark {
		width: 60px;
		height: 60px;
		display: grid;
		place-items: center;
		margin-bottom: 14px;
		margin-inline: auto;
		color: var(--accent);
		border: 1px solid var(--line-strong);
		border-radius: 50%;
	}

	.gate h1 {
		font-size: clamp(24px, 3vw, 32px);
		font-weight: 500;
		margin: 0 0 10px;
		line-height: 1.1;
	}

	.subtitle {
		font-size: 17px;
		color: var(--ink-soft);
		margin: 0 0 22px;
		line-height: 1.45;
	}

	form {
		display: flex;
		gap: 10px;
	}

	input {
		flex: 1;
		min-width: 0;
		font-family: var(--font-body);
		font-size: 17px;
		padding: 10px 12px;
		background: var(--paper);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		color: var(--ink);
	}

	input[aria-invalid='true'] {
		border-color: var(--accent);
	}

	button {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 0 18px;
		background: var(--accent);
		color: var(--paper);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		white-space: nowrap;
	}

	button:hover {
		background: var(--accent-ink);
	}

	.err {
		margin: 12px 0 0;
		color: var(--accent);
	}

	.hint {
		margin: 14px 0 0;
		font-size: 14px;
		color: var(--ink-faint);
		line-height: 1.45;
	}

	.hint-label { display: block; color: var(--ink-soft); }
	.hint a { display: flex; align-items: center; width: fit-content; min-height: 44px; margin-top: 6px; color: var(--accent-ink); font: 16px/1.4 var(--font-ui); text-decoration: underline; text-underline-offset: 3px; }
</style>

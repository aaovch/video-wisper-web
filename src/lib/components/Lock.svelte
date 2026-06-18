<script lang="ts">
	import { base } from '$app/paths';
	import { lock } from '$lib/lock.svelte';
	import type { Collection } from '$lib/data/collections';

	let {
		targets,
		title = 'Закрытая коллекция',
		subtitle = 'Введите пароль, чтобы открыть доступ.'
	}: { targets: Collection[]; title?: string; subtitle?: string } = $props();

	const hint = $derived(targets.find((c) => c.passwordHint)?.passwordHint);

	let value = $state('');
	let failed = $state(false);

	function submit(e: Event) {
		e.preventDefault();
		if (lock.tryUnlock(targets, value.trim())) {
			failed = false;
			value = '';
		} else {
			failed = true;
		}
	}
</script>

<section class="container gate-wrap">
	<a class="back label" href="{base}/">← Все коллекции</a>
	<div class="gate">
		<span class="lock-mark" aria-hidden="true">🔒</span>
		<h1>{title}</h1>
		<p class="subtitle">{subtitle}</p>
		<form onsubmit={submit}>
			<input
				type="password"
				bind:value
				placeholder="Пароль"
				autocomplete="off"
				aria-label="Пароль"
				aria-invalid={failed}
				oninput={() => (failed = false)}
			/>
			<button type="submit">Открыть</button>
		</form>
		{#if failed}
			<p class="err label" role="alert">Неверный пароль</p>
		{:else if hint}
			<p class="hint">{hint}</p>
		{/if}
	</div>
</section>

<style>
	.gate-wrap {
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

	.gate {
		max-width: 420px;
		margin: 8vh auto 0;
		text-align: center;
		padding: 36px 28px 32px;
		background: var(--paper-2);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}

	.lock-mark {
		font-size: 30px;
		line-height: 1;
		display: block;
		margin-bottom: 14px;
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
</style>

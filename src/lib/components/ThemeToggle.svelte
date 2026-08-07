<script lang="ts">
	import Moon from 'phosphor-svelte/lib/Moon';
	import Sun from 'phosphor-svelte/lib/Sun';
	import { theme } from '$lib/theme.svelte';

	const isDark = $derived(theme.current === 'dark');
</script>

<button
	type="button"
	class="theme-toggle"
	onclick={() => theme.toggle()}
	aria-pressed={isDark}
	aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
	title={isDark ? 'Светлая тема' : 'Тёмная тема'}
>
	{#if isDark}
		<Sun size={18} weight="regular" aria-hidden="true" />
	{:else}
		<Moon size={18} weight="regular" aria-hidden="true" />
	{/if}
</button>

<style>
	.theme-toggle {
		display: inline-grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: color-mix(in srgb, var(--paper) 82%, transparent);
		color: var(--ink-soft);
		cursor: pointer;
		transition:
			color 0.2s ease,
			border-color 0.2s ease,
			background 0.2s ease,
			transform 0.2s ease;
	}

	.theme-toggle:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.theme-toggle :global(svg) {
		transition: transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.theme-toggle:hover :global(svg) {
		transform: rotate(-18deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.theme-toggle,
		.theme-toggle :global(svg) {
			transition: none;
		}
	}
</style>

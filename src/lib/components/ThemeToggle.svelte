<script lang="ts">
	import { Toggle } from '@ui-sdk/svelte/toggle';
	import Moon from 'phosphor-svelte/lib/Moon';
	import Sun from 'phosphor-svelte/lib/Sun';
	import { theme } from '$lib/theme.svelte';
	let { language = 'ru' }: { language?: 'ru' | 'en' } = $props();

	const isDark = $derived(theme.current === 'dark');
</script>

<Toggle bind:pressed={() => isDark, (pressed) => theme.set(pressed ? 'dark' : 'light')}
	aria-label={language === 'en' ? 'Dark theme' : 'Тёмная тема'}
	title={language === 'en' ? (isDark ? 'Light theme' : 'Dark theme') : (isDark ? 'Светлая тема' : 'Тёмная тема')}
>
	{#snippet render({ props })}
	<button {...props} class="theme-toggle">
	{#if isDark}
		<Sun size={18} weight="regular" aria-hidden="true" />
	{:else}
		<Moon size={18} weight="regular" aria-hidden="true" />
	{/if}
</button>
	{/snippet}
</Toggle>

<style>
	.theme-toggle {
		display: inline-grid;
		place-items: center;
		width: var(--hit);
		height: var(--hit);
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

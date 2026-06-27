<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { formatVisitCount, type CounterTarget } from '$lib/visit-counter';
	import { ensureVisitCount, getVisitCount } from '$lib/visit-counter.svelte';

	let {
		target = { kind: 'site' },
		suffix = 'посещений',
		lazy = false,
		class: className = ''
	}: {
		target?: CounterTarget;
		suffix?: string;
		/** Не грузить, пока элемент не попадёт во viewport (для карточек). */
		lazy?: boolean;
		class?: string;
	} = $props();

	let root = $state<HTMLElement | null>(null);
	let queued = $state(false);
	let failed = $state(false);

	const count = $derived(getVisitCount(target));
	const label = $derived(count === undefined ? null : formatVisitCount(count));
	const ready = $derived(label !== null && !failed);
	// Уже в кэше — показываем сразу, без fade-in при навигации.
	const visible = $derived(ready && (count !== undefined || failed));

	onMount(() => {
		if (!browser) return;
		if (!lazy) {
			queued = true;
			return;
		}
		if (!root) return;

		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					queued = true;
					io.disconnect();
				}
			},
			{ rootMargin: '120px 0px' }
		);

		io.observe(root);
		return () => io.disconnect();
	});

	$effect(() => {
		if (!browser || !queued || count !== undefined) return;
		void load();
	});

	async function load() {
		try {
			await ensureVisitCount(target);
			failed = false;
		} catch {
			failed = true;
		}
	}
</script>

<span
	bind:this={root}
	class="visit-counter {className}"
	class:ready={visible}
	class:instant={count !== undefined}
	class:failed
	aria-label={visible ? `${suffix}: ${label}` : undefined}
>
	{#if ready}
		{label} {suffix}
	{/if}
</span>

<style>
	.visit-counter {
		display: inline-block;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		opacity: 0;
		transition: opacity 0.25s ease;
	}

	.visit-counter.ready {
		opacity: 1;
	}

	.visit-counter.instant {
		opacity: 1;
		transition: none;
	}

	.visit-counter.failed {
		display: none;
	}
</style>

<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import {
		type CounterTarget,
		fetchVisitCount,
		formatVisitCount,
		isCounterPage,
		trackVisit
	} from '$lib/visit-counter';

	let {
		target = { kind: 'site' },
		track = true,
		suffix = 'посещений',
		class: className = ''
	}: {
		target?: CounterTarget;
		track?: boolean;
		suffix?: string;
		class?: string;
	} = $props();

	let count = $state<number | null>(null);
	let failed = $state(false);

	async function refresh() {
		if (!browser) return;
		try {
			if (track && isCounterPage(target, page.url.pathname)) {
				await trackVisit(target);
			}
			count = await fetchVisitCount(target);
			failed = false;
		} catch {
			failed = true;
		}
	}

	afterNavigate(() => {
		void refresh();
	});

	const label = $derived(count === null ? null : formatVisitCount(count));
</script>

{#if label && !failed}
	<span class={className} aria-label="{suffix}: {label}">{label} {suffix}</span>
{/if}

<script lang="ts">
	import type { Snippet } from 'svelte';
	let { identity, children }: { identity: string; children: Snippet } = $props();
</script>

<!-- Resource changes reset local state; query/hash navigation preserves it. -->
{#key identity}
	{@render children()}
{/key}

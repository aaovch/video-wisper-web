<script lang="ts">
	import type { SearchHit } from '$lib/search-types';
	import { highlightParts } from '$lib/text-highlight';
	let { hit, query }: { hit: SearchHit; query: string } = $props();
	const inSnippet = $derived(highlightParts(hit.snippet, query).some(part => part.match));
	const inTitle = $derived(highlightParts(hit.title, query).some(part => part.match));
	const label = $derived(hit.matchReasonKind === 'tag' ? 'Метка материала'
		: hit.matchKind === 'semantic' ? 'Связано по смыслу'
		: hit.matchKind === 'correction' ? 'С учётом опечатки'
		: hit.matchKind === 'prefix' ? 'По началу слова'
		: !inSnippet && inTitle ? 'Совпадение в заголовке'
		: !inSnippet && highlightParts(hit.reportTitle, query).some(part => part.match) ? 'Совпадение в названии материала' : '');
</script>

{#if label}<p class="match-note">{label}{#if hit.matchReason?.length && hit.matchReasonKind !== 'correction'}: {hit.matchReason.join(' · ')}{/if}</p>{/if}

<style>
	.match-note { margin: 0 0 8px; color: var(--ink-soft); font-family: var(--font-ui); font-size: 12px; line-height: 1.5; }
</style>

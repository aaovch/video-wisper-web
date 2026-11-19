<script lang="ts">
	import PageMetadata from '$lib/components/PageMetadata.svelte';
	import ServerStatistics from '$lib/components/ServerStatistics.svelte';
	import StaticStatistics from '$lib/components/StaticStatistics.svelte';
	import { communityArchive, SITE_NAME } from '$lib/site';
</script>

<PageMetadata title={`Статистика — ${SITE_NAME}`} noindex />

{#if communityArchive}
	<ServerStatistics />
{:else}
	<StaticStatistics />
{/if}

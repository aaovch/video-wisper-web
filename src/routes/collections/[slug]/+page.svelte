<script lang="ts">
	import ResourceView from '$lib/components/ResourceView.svelte';
	import CollectionView from '$lib/components/CollectionView.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<ResourceView identity={data.collection.slug}>
	<CollectionView collection={data.collection} reports={data.reports} />
</ResourceView>

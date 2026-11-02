<script lang="ts">
	import ResourceView from '$lib/components/ResourceView.svelte';
	import ReportView from '$lib/components/ReportView.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<ResourceView identity={data.report.slug}>
	<ReportView report={data.report} />
</ResourceView>

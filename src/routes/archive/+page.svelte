<script lang="ts">
	import PageMetadata from '$lib/components/PageMetadata.svelte';
 import ArchiveHome from '$lib/components/ArchiveHome.svelte';
 import { SITE_HOME_TITLE } from '$lib/site';
</script>

<PageMetadata title={`Архив — ${SITE_HOME_TITLE}`} description="Архивные коллекции с отдельным поиском по материалам." />

<ArchiveHome archived />

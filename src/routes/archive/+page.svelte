<script lang="ts">
 import ArchiveHome from '$lib/components/ArchiveHome.svelte';
 import { SITE_HOME_TITLE } from '$lib/site';
</script>

<svelte:head>
 <title>Архив — {SITE_HOME_TITLE}</title>
 <meta name="description" content="Архивные коллекции с отдельным поиском по материалам." />
</svelte:head>

<ArchiveHome archived />

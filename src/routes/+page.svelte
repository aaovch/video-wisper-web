<script lang="ts">
	import ArchiveHome from '$lib/components/ArchiveHome.svelte';
	import { SITE_HOME_TITLE } from '$lib/site';
</script>

<svelte:head>
	<title>{SITE_HOME_TITLE}</title>
	<meta
		name="description"
		content="Личный архив HEMA: коллекции тренировок, семинаров и боёв с поиском по смысловым блокам и таймкодам."
	/>
</svelte:head>

<ArchiveHome />

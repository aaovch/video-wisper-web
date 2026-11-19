<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { SITE_NAME, SITE_ORIGIN, SITE_HOME_TITLE, SITE_DESCRIPTION } from '$lib/site';
	import { canonicalUrl, socialImage, socialImageAlt } from '$lib/site-metadata.js';

	let { title = SITE_HOME_TITLE, description = SITE_DESCRIPTION, type = 'website', language = 'ru', noindex = false }:
		{ title?: string; description?: string; type?: 'website' | 'article'; language?: string; noindex?: boolean } = $props();
	const canonical = $derived(canonicalUrl(page.url.pathname, SITE_ORIGIN));
	const image = new URL(base + socialImage, SITE_ORIGIN).href;
	// Server tags are needed before JS; Svelte owns metadata after mounting.
	onMount(() => document.querySelectorAll('[data-server-meta]').forEach((tag) => {
		// Svelte sets document.title, reusing the existing title element.
		if (tag.tagName === 'TITLE') tag.removeAttribute('data-server-meta');
		else tag.remove();
	}));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description || SITE_DESCRIPTION} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content={type} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description || SITE_DESCRIPTION} />
	<meta property="og:url" content={canonical} />
	<meta property="og:locale" content={language === 'en' ? 'en_US' : 'ru_RU'} />
	<meta property="og:image" content={image} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={socialImageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description || SITE_DESCRIPTION} />
	<meta name="twitter:image" content={image} />
	<meta name="twitter:image:alt" content={socialImageAlt} />
	{#if noindex}<meta name="robots" content="noindex" />{/if}
</svelte:head>

<script lang="ts">
 import {base} from '$app/paths';
 import {relatedSources} from '$lib/search-source-links';
 import type {SearchHit,SearchScope} from '$lib/search-types';
 import {formatTime} from '$lib/utils';
 let {hit,scope,language='ru'}:{hit:SearchHit;scope:SearchScope|undefined;language?:'ru'|'en'}=$props();
 const links=$derived(relatedSources(hit,scope));
</script>
{#each links as link (link.id)}
 <aside aria-label={language==='en'?'Related source':'Связанный источник'}>
  <p>{language==='en'?'Related material':link.explanation}</p>
  <a href={`${base}${link.href}`}>{language==='en'?'Open related chapter':link.role} → {link.title} · {formatTime(link.start)}</a>
  <small>{link.reportTitle}</small>
 </aside>
{/each}
<style>
 aside{margin-top:1rem;padding-left:.8rem;border-left:2px solid currentColor;font-size:.88rem;line-height:1.5;overflow-wrap:anywhere}
 p{margin:0 0 .4rem;opacity:.8}a{color:inherit;text-decoration:underline;text-underline-offset:.15em}small{display:block;margin-top:.25rem;opacity:.7}
</style>

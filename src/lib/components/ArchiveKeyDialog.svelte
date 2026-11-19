<script lang="ts">
	import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from '@ui-sdk/svelte/collapsible';
	import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@ui-sdk/svelte/dialog';
	import { Field, FieldLabel, FieldError } from '@ui-sdk/svelte/field';
	import { Input } from '@ui-sdk/svelte/input';
	import { Button } from '@ui-sdk/svelte/button';
	import { base } from '$app/paths';
	import { allAccessTargets, collectionGate, getCollection, type AccessTarget, type Collection } from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';

	let isOpen = $state(false);
	let collection = $state<Collection>();
	let value = $state('');
	let error = $state('');
	let busy = $state(false);
	const targets = $derived(collection ? collectionGate(collection) : allAccessTargets());
	const hints = $derived([...new Set(targets.map(t => t.passwordHint).filter(Boolean))]);
	const contacts = $derived.by(() => {
		const byUrl = new Map<string, { label: string; titles: Set<string> }>();
		for (const target of targets) {
			const contact = target.passwordContact;
			if (!contact) continue;
			const entry = byUrl.get(contact.url) ?? { label: contact.label, titles: new Set<string>() };
			entry.titles.add(getCollection(target.collectionSlug)?.title ?? target.title);
			byUrl.set(contact.url, entry);
		}
		return [...byUrl];
	});
	function destination(target?: AccessTarget) {
		if (!target) return collection ? `${base}/collections/${collection.slug}/` : `${base}/`;
		const targetCollection = getCollection(target.collectionSlug);
		const pass = targetCollection?.access?.passes?.find(item => item.id === target.id);
		return pass?.items.length === 1
			? `${base}/reports/${pass.items[0]}/?from=${target.collectionSlug}`
			: `${base}/collections/${target.collectionSlug}/`;
	}

	export function open(selected?: Collection) {
		collection = selected;
		value = '';
		error = '';
		isOpen = true;
	}
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		busy = true;
		try {
			if (!await lock.tryUnlock(targets, value.trim(), destination)) {
				error = 'Ключ не подошёл. Проверьте его и попробуйте ещё раз.';
			}
		} finally { busy = false; }
	}
</script>

	{#snippet contactList()}
		{#each contacts as [url, entry]}
			<p class="contact"><a href={url} target="_blank" rel="noopener noreferrer">{entry.label}</a>
				{#if !collection}<small>{[...entry.titles].join(' · ')}</small>{/if}
			</p>
		{/each}
	{/snippet}

<Dialog bind:open={isOpen} onOpenChange={(next) => { if (!next) { value = ''; error = ''; } }}>
<DialogContent class="access-dialog" initialFocus="input">
	<header><DialogTitle>{collection?.title ?? 'Открыть материалы'}</DialogTitle><DialogClose aria-label="Закрыть">×</DialogClose></header>
	<DialogDescription class="hint">{collection?.private ? 'Введите ключ этой закрытой коллекции.' : 'Подойдёт ключ отдельной записи или всей коллекции.'}</DialogDescription>
	<form onsubmit={submit}>
		<Field invalid={!!error}>
			<FieldLabel>Ключ доступа</FieldLabel>
			<Input type="text" bind:value required autocomplete="off" autocapitalize="none" spellcheck={false} onValueChange={() => error = ''} data-agent-secret />
			{#if error}<FieldError>{error}</FieldError>{/if}
		</Field>
		<Button type="submit" class="submit" disabled={busy}>{busy ? 'Проверяем…' : 'Открыть доступ'}</Button>
	</form>

	{#if collection}
		{#each hints as hint}<p>{hint}</p>{/each}
		{@render contactList()}
	{:else}
		<div><Collapsible>
	<CollapsibleTrigger>
		{#snippet render({ props })}
			<button {...props} class="disclosure-trigger">Как получить ключ?</button>
		{/snippet}
	</CollapsibleTrigger>
	<CollapsiblePanel keepMounted>{@render contactList()}</CollapsiblePanel>
</Collapsible></div>
	{/if}
</DialogContent>
</Dialog>

<style>
	.disclosure-trigger { text-align: start; font: inherit; color: inherit; background: transparent; border: 0; padding: 0; cursor: pointer; }
	:global(.access-dialog) { position: fixed; inset: 0; overflow-y: auto; margin: auto; height: fit-content; width: min(440px, 94vw); max-height: 90dvh; padding: 24px; background: var(--surface); color: var(--ink); border: 1px solid var(--line-strong); border-radius: var(--radius); }
	:global(.access-dialog)::backdrop { background: #19151088; }
	header { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
	:global(.access-dialog h2) { font-size: 1.6rem; }


	:global(.access-dialog .hint) { color: var(--ink-soft); margin: 6px 0 0; }
	:global(.access-dialog button), :global(.access-dialog input) { font: inherit; color: inherit; }
	header :global(button) { background: none; border: none; font-size: 24px; min-width: 44px; cursor: pointer; }
	form { display: grid; gap: 12px; margin-block: 16px; }
	:global(.access-dialog input) { display: block; width: 100%; margin-top: 6px; padding: 12px; background: transparent; border: 1px solid var(--edge); }
	:global(.access-dialog .submit) { padding: 12px; background: var(--accent); color: var(--on-action); border: 0; cursor: pointer; }
	.disclosure-trigger { padding-block: 10px; cursor: pointer; }
	.contact { margin-block: 8px 14px; }
	.contact a { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 3px; }
	.contact small { display: block; color: var(--ink-soft); }
	@media(max-width: 600px) { :global(.access-dialog) { margin: auto auto 0; width: 100%; max-width: 100%; border-radius: 14px 14px 0 0; padding-bottom: max(20px,env(safe-area-inset-bottom)); } }

	form, .disclosure-trigger { font: 16px/1.5 var(--font-ui); }
	:global(.access-dialog [data-slot="field-error"]) { color: var(--danger); }
	:global(.access-dialog input[aria-invalid="true"]) { outline: 2px solid var(--danger); }
	:global(.access-dialog .submit), header :global(button) { min-height: var(--hit); border-radius: var(--radius); }
</style>

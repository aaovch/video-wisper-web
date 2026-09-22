<script lang="ts">
	import { browser } from '$app/environment';
	import { base } from '$app/paths';
	import BookOpenText from 'phosphor-svelte/lib/BookOpenText';
	import Cards from 'phosphor-svelte/lib/Cards';
	import Check from 'phosphor-svelte/lib/Check';
	import CopySimple from 'phosphor-svelte/lib/CopySimple';
	import ImageSquare from 'phosphor-svelte/lib/ImageSquare';
	import TextAlignLeft from 'phosphor-svelte/lib/TextAlignLeft';
	import { copyText } from '$lib/clipboard';
	import { materialVisualLabel } from '$lib/report-materials';
	import type { ReportMaterials } from '$lib/types';

	type MaterialsTab = 'notes' | 'visuals' | 'glossary' | 'transcript';
	let { slug, materials, hasTranscript, language = 'ru' }: { slug: string; materials: Required<ReportMaterials>; hasTranscript: boolean; language?: 'ru' | 'en' } = $props();
	let requestedTab = $state<MaterialsTab>('notes');
	let transcriptText = $state('');
	let transcriptLoadState = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let transcriptPromise: Promise<string> | null = null;
	let copyState = $state<'idle' | 'copied' | 'error'>('idle');
	let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

	const tabs = $derived.by<MaterialsTab[]>(() => {
		const next: MaterialsTab[] = [];
		if (materials.notes.length) next.push('notes');
		if (materials.visuals.length) next.push('visuals');
		if (materials.glossary.length) next.push('glossary');
		if (hasTranscript) next.push('transcript');
		return next;
	});
	const activeTab = $derived(tabs.includes(requestedTab) ? requestedTab : (tabs[0] ?? 'transcript'));

	const TRANSCRIPT_SCALE_KEY = 'transcript-scale';
	function readTranscriptScale(): number {
		try {
			const saved = Number(localStorage.getItem(TRANSCRIPT_SCALE_KEY));
			if (saved >= 0.8 && saved <= 1.3) return saved;
		} catch {
			// Без storage остаётся базовый размер.
		}
		return 1;
	}
	let transcriptScale = $state(browser ? readTranscriptScale() : 1);
	function adjustTranscriptScale(delta: number) {
		transcriptScale = Math.round(Math.min(1.3, Math.max(0.8, transcriptScale + delta)) * 10) / 10;
		try { localStorage.setItem(TRANSCRIPT_SCALE_KEY, String(transcriptScale)); } catch { /* Не критично. */ }
	}

	function ensureTranscript(): Promise<string> {
		if (!browser || !hasTranscript) return Promise.resolve('');
		if (transcriptPromise) return transcriptPromise;
		transcriptLoadState = 'loading';
		transcriptPromise = fetch(`${base}/transcripts/${slug}.json`)
			.then((response) => {
				if (!response.ok) throw new Error(`Transcript ${response.status}`);
				return response.json() as Promise<{ transcript?: string }>;
			})
			.then((data) => {
				transcriptText = data.transcript ?? '';
				transcriptLoadState = 'ready';
				return transcriptText;
			})
			.catch((error) => {
				transcriptPromise = null;
				transcriptLoadState = 'error';
				throw error;
			});
		return transcriptPromise;
	}

	$effect(() => {
		if (activeTab === 'transcript') void ensureTranscript().catch(() => {});
	});

	function selectTab(tab: MaterialsTab) { requestedTab = tab; }
	function handleTabKeydown(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || tabs.length < 2) return;
		event.preventDefault();
		const currentIndex = Math.max(0, tabs.indexOf(activeTab));
		const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
		requestedTab = tabs[nextIndex];
		queueMicrotask(() => document.getElementById(`materials-tab-${requestedTab}`)?.focus());
	}

	async function copyTranscript() {
		try {
			const text = await ensureTranscript();
			copyState = text && await copyText(text) ? 'copied' : 'error';
		} catch { copyState = 'error'; }
		clearTimeout(copyResetTimer);
		copyResetTimer = setTimeout(() => (copyState = 'idle'), 2200);
	}
</script>

<section class="study-materials" aria-label={language === 'en' ? 'Lecture materials' : 'Материалы лекции'}>
	<div class="tablist" role="tablist" aria-label={language === 'en' ? 'Material sections' : 'Разделы материалов'}>
		{#each tabs as tab (tab)}
			<button id={`materials-tab-${tab}`} type="button" role="tab" class:active={activeTab === tab} aria-selected={activeTab === tab} aria-controls={`materials-panel-${tab}`} tabindex={activeTab === tab ? 0 : -1} onclick={() => selectTab(tab)} onkeydown={handleTabKeydown}>
				{#if tab === 'notes'}<BookOpenText size={17} aria-hidden="true" /><span>{language === 'en' ? 'Notes' : 'Конспект'}</span><span class="count">{materials.notes.length}</span>
				{:else if tab === 'visuals'}<ImageSquare size={17} aria-hidden="true" /><span>{language === 'en' ? (materials.visuals.length === 1 ? 'Guide' : 'Guides') : (materials.visuals.length === 1 ? 'Памятка' : 'Памятки')}</span>{#if materials.visuals.length > 1}<span class="count">{materials.visuals.length}</span>{/if}
				{:else if tab === 'glossary'}<Cards size={17} aria-hidden="true" /><span>{language === 'en' ? 'Glossary' : 'Глоссарий'}</span><span class="count">{materials.glossary.length}</span>
				{:else}<TextAlignLeft size={17} aria-hidden="true" /><span>{language === 'en' ? 'Transcript' : 'Расшифровка'}</span>{/if}
			</button>
		{/each}
	</div>

	{#if activeTab === 'notes'}
		<div id="materials-panel-notes" class="panel" role="tabpanel" aria-labelledby="materials-tab-notes">
			<header class="panel-head"><span class="kicker"><BookOpenText size={16} aria-hidden="true" /> {language === 'en' ? 'Lecture notes' : 'Короткий конспект'}</span><span>{materials.notes.length} {language === 'en' ? (materials.notes.length === 1 ? 'section' : 'sections') : (materials.notes.length === 1 ? 'раздел' : materials.notes.length < 5 ? 'раздела' : 'разделов')}</span></header>
			<div class="notes-grid">{#each materials.notes as section, index (section.title)}<article><header><span>{String(index + 1).padStart(2, '0')}</span><h3>{section.title}</h3></header><ul>{#each section.items as item}<li>{item}</li>{/each}</ul></article>{/each}</div>
		</div>
	{:else if activeTab === 'visuals'}
		<div id="materials-panel-visuals" class="panel" role="tabpanel" aria-labelledby="materials-tab-visuals">
			<header class="panel-head"><span class="kicker"><ImageSquare size={16} aria-hidden="true" /> {language === 'en' ? 'Visual guides' : 'Визуальные памятки'}</span><span>{materials.visuals.length} {language === 'en' ? (materials.visuals.length === 1 ? 'item' : 'items') : (materials.visuals.length === 1 ? 'материал' : 'материала')}</span></header>
			<div class="visuals">{#each materials.visuals as visual (`${visual.kind}:${visual.src}`)}<figure>{#if materials.visuals.length > 1}<figcaption>{materialVisualLabel(visual, language)}</figcaption>{/if}<a href={`${base}/${visual.src}`} target="_blank" rel="noreferrer" aria-label={language === 'en' ? `Open “${materialVisualLabel(visual, language)}” full size` : `Открыть «${materialVisualLabel(visual, language)}» в полном размере`}><img src={`${base}/${visual.src}`} alt={visual.alt} loading="lazy" decoding="async" /></a></figure>{/each}</div>
		</div>
	{:else if activeTab === 'glossary'}
		<div id="materials-panel-glossary" class="panel" role="tabpanel" aria-labelledby="materials-tab-glossary">
			<header class="panel-head"><span class="kicker"><Cards size={16} aria-hidden="true" /> {language === 'en' ? 'Terms and definitions' : 'Термины и определения'}</span><span>{materials.glossary.length} {language === 'en' ? 'terms' : 'терминов'}</span></header>
			<dl class="glossary-grid">{#each materials.glossary as item (item.term)}<div><dt>{item.term}</dt><dd>{item.definition}</dd></div>{/each}</dl>
		</div>
	{:else}
		<div id="materials-panel-transcript" class="panel" role="tabpanel" aria-labelledby="materials-tab-transcript">
			<header class="panel-head">
				<span class="kicker"><TextAlignLeft size={16} aria-hidden="true" /> {language === 'en' ? 'Full lecture transcript' : 'Полный текст лекции'}</span>
				<span class="font-controls" aria-label={language === 'en' ? 'Text size' : 'Размер текста'}><button type="button" onclick={() => adjustTranscriptScale(-0.1)} disabled={transcriptScale <= 0.8} aria-label={language === 'en' ? 'Decrease text size' : 'Уменьшить текст'}>A−</button><button type="button" onclick={() => adjustTranscriptScale(0.1)} disabled={transcriptScale >= 1.3} aria-label={language === 'en' ? 'Increase text size' : 'Увеличить текст'}>A+</button></span>
				<button type="button" class="copy" class:copied={copyState === 'copied'} aria-label={language === 'en' ? (copyState === 'copied' ? 'Transcript copied' : 'Copy full transcript') : (copyState === 'copied' ? 'Расшифровка скопирована' : 'Скопировать полную расшифровку')} onclick={copyTranscript}>{#if copyState === 'copied'}<Check size={18} weight="bold" />{:else}<CopySimple size={18} />{/if}</button>
				<span class="copy-status" role="status" aria-live="polite">{language === 'en' ? (copyState === 'copied' ? 'Transcript copied' : copyState === 'error' ? 'Could not copy transcript' : '') : (copyState === 'copied' ? 'Расшифровка скопирована' : copyState === 'error' ? 'Не удалось скопировать расшифровку' : '')}</span>
			</header>
			<div class="transcript" style={`--transcript-scale: ${transcriptScale}`}>
				{#if transcriptLoadState === 'ready'}<p>{transcriptText}</p>{:else if transcriptLoadState === 'error'}<p class="status">{language === 'en' ? 'The transcript could not be loaded. Refresh the page and try again.' : 'Не удалось загрузить расшифровку. Обновите страницу и попробуйте ещё раз.'}</p>{:else}<p class="status">{language === 'en' ? 'Loading transcript…' : 'Загрузка расшифровки…'}</p>{/if}
			</div>
		</div>
	{/if}
</section>

<style>
	.study-materials { overflow: hidden; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--paper); }
	.tablist { display: flex; gap: 4px; overflow-x: auto; padding: 6px; border-bottom: 1px solid var(--line-strong); background: var(--paper-2); scrollbar-width: thin; }
	.tablist button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 8px 12px; border: 1px solid transparent; border-radius: var(--radius); background: transparent; color: var(--ink-soft); font: inherit; font-size: 13px; white-space: nowrap; cursor: pointer; }
	.tablist button.active { border-color: color-mix(in srgb, var(--accent) 28%, var(--line)); background: var(--paper); color: var(--accent); }
	.count { min-width: 20px; padding: 1px 6px; border-radius: 999px; background: color-mix(in srgb, var(--ink-faint) 10%, transparent); font-family: var(--font-mono); font-size: 10px; text-align: center; }
	.panel-head { min-height: 56px; padding: 16px 18px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 16px; color: var(--ink-faint); font-family: var(--font-mono); font-size: 10px; letter-spacing: .06em; text-transform: uppercase; }
	.kicker { display: inline-flex; align-items: center; gap: 8px; margin-right: auto; color: var(--ink); font-weight: 600; }
	.notes-grid, .glossary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin: 0; padding: 0; background: var(--line); }
	.notes-grid article, .glossary-grid > div { min-width: 0; padding: 20px; background: var(--paper); }
	.notes-grid article header { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; margin-bottom: 12px; }
	.notes-grid article header > span { color: var(--accent); font-family: var(--font-mono); font-size: 10px; }
	.notes-grid h3 { margin: 0; font-size: 17px; line-height: 1.25; }
	.notes-grid ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; color: var(--ink-soft); font-size: 14px; line-height: 1.58; }
	.notes-grid li { position: relative; padding-left: 13px; overflow-wrap: anywhere; }
	.notes-grid li::before { content: ''; position: absolute; left: 0; top: .72em; width: 5px; height: 1px; background: var(--accent); }
	.glossary-grid dt { margin: 0 0 7px; font-size: 16px; font-weight: 600; }
	.glossary-grid dd { margin: 0; color: var(--ink-soft); font-size: 14px; line-height: 1.58; overflow-wrap: anywhere; }
	.visuals { display: grid; gap: 1px; background: var(--line); }
	.visuals figure { min-width: 0; margin: 0; padding: 18px; background: var(--paper); }
	.visuals figcaption { margin-bottom: 12px; font-size: 15px; font-weight: 600; }
	.visuals a, .visuals img { display: block; width: 100%; border-radius: 8px; }
	.visuals img { height: auto; border: 1px solid var(--line); background: #fff; }
	.font-controls { display: inline-flex; gap: 4px; }
	.font-controls button, .copy { min-width: 36px; min-height: 36px; border: 1px solid var(--line-strong); border-radius: 999px; background: transparent; color: var(--accent); font: inherit; cursor: pointer; }
	.font-controls button:disabled { opacity: .35; cursor: default; }
	.copy { display: grid; place-items: center; }
	.copy.copied { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
	.copy-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
	.transcript { max-height: min(62vh, 560px); overflow: auto; overscroll-behavior: contain; }
	.transcript p { max-width: none; margin: 0; padding: 24px; color: var(--ink-soft); font-size: calc(16px * var(--transcript-scale)); line-height: 1.75; white-space: pre-wrap; }
	.transcript .status { color: var(--ink-faint); font-style: italic; }
	button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

	@media (max-width: 520px) {
		.tablist { gap: 2px; padding: 4px; }
		.tablist button { padding: 7px 8px; gap: 5px; font-size: 12px; }
		.tablist button :global(svg) { display: none; }
		.panel-head { align-items: flex-start; flex-wrap: wrap; padding: 14px; }
		.notes-grid, .glossary-grid { grid-template-columns: 1fr; }
		.notes-grid article, .glossary-grid > div { padding: 17px 15px; }
		.visuals figure { padding: 14px; }
		.transcript p { padding: 18px 15px; }
	}
</style>

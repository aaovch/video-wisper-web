<script lang="ts">
	import StatisticsSelect from './StatisticsSelect.svelte';
	import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from '@ui-sdk/svelte/collapsible';
	import { Toggle } from '@ui-sdk/svelte/toggle';
	import { Button } from '@ui-sdk/svelte/button';
	import { Input } from '@ui-sdk/svelte/input';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { collections } from '$lib/data/collections';
	import { getAllReportSummaries } from '$lib/data/report-meta';
	import { parseSnapshot, periodStart, periodVisits, csvCell, type AnalyticsSnapshot } from '$lib/analytics';

	const visibleCollections = collections.filter(c => c.hema && !c.catalogHidden && !c.isolated);
	const reports = getAllReportSummaries().filter(r => visibleCollections.some(c => c.items.includes(r.slug)));
	let snapshot = $state<AnalyticsSnapshot | null>(null);
	let loading = $state(false);
	let failed = $state(false);
	let excluded = $state<boolean | null>(null);
	let savingPreference = $state(false);
	let preferenceError = $state('');
	async function preference(next?: boolean) {
		savingPreference = true;
		preferenceError = '';
		try {
			const response = await fetch('/api/statistics/preference' + (next === undefined ? '' : `?excluded=${Number(next)}`), {
				method: next === undefined ? 'GET' : 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000)
			});
			if (!response.ok) throw new Error();
			excluded = (await response.json()).excluded;
		} catch { preferenceError = 'Не удалось обновить настройку. Попробуйте ещё раз.'; }
		finally { savingPreference = false; }
	}
	let period = $state('30');
	let query = $state('');
	let collection = $state('');
	const from = $derived(snapshot ? period === 'all' ? snapshot.startDate : [snapshot.startDate, periodStart(snapshot.endDate, Number(period))].sort().at(-1)! : '');
	const rows = $derived(reports.filter(r =>
		(!query.trim() || r.title.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))) &&
		(!collection || collections.find(c => c.slug === collection)?.items.includes(r.slug))
	).map(r => ({
		...r, visits: snapshot ? periodVisits(snapshot.rows.find(s => s.slug === r.slug), from, snapshot.endDate) ?? 0 : null
	})).sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0) || a.title.localeCompare(b.title, 'ru')));
	const total = $derived(snapshot ? rows.reduce((sum, row) => sum + (row.visits ?? 0), 0) : null);
	const viewed = $derived(snapshot ? rows.filter(r => r.visits).length : null);
	const days = $derived.by(() => {
		if (!snapshot) return [];
		const selected = new Set(rows.map(r => r.slug));
		const counts = new Map<string, number>();
		for (let day = from; day <= snapshot.endDate; day = periodStart(day, 0)) counts.set(day, 0);
		for (const row of snapshot.rows) if (selected.has(row.slug)) {
			for (const point of row.daily) if (counts.has(point.day)) counts.set(point.day, counts.get(point.day)! + point.visits);
		}
		return [...counts].map(([day, visits]) => ({ day, visits }));
	});
	const max = $derived(Math.max(1, ...days.map(d => d.visits)));
	const number = (n: number | null) => n === null ? '—' : n.toLocaleString('ru-RU');
	const date = (day: string) => day.split('-').reverse().join('.');
	async function load() {
		if (loading) return;
		loading = true;
		failed = false;
		try {
			const response = await fetch('/api/statistics', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
			if (!response.ok) throw new Error('Statistics unavailable');
			snapshot = parseSnapshot(await response.json());
		} catch { failed = true; }
		finally { loading = false; }
	}
	function download() {
		const data = [['Запись', 'Открытия', 'С', 'По'], ...rows.map(r => [r.title, r.visits ?? '', from, snapshot?.endDate ?? ''])];
		const url = URL.createObjectURL(new Blob(['\uFEFF' + data.map(row => row.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = 'hema-statistics.csv';
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
	onMount(() => { void load(); void preference(); });
</script>

<div class="container statistics">
	<a href="{base}/">← На главную</a>
	<header><h1>Статистика архива</h1><Button onclick={load} disabled={loading}>
		{#snippet render({ props })}
			<button {...props}>{loading ? 'Обновляем…' : 'Обновить'}</button>
		{/snippet}
	</Button></header>

	<p class="status" role="status">
		{#if failed}Не удалось загрузить статистику.{#if snapshot} Показаны последние полученные данные.{/if}
		{:else if snapshot}{date(from)} — {date(snapshot.endDate)}
		{:else}Загружаем статистику…{/if}
	</p>
	<div class="filters">
		<label>Период<StatisticsSelect bind:value={period} label="Период" items={[{ value: '7', label: '7 дней' }, { value: '30', label: '30 дней' }, { value: 'all', label: 'С начала учёта' }]} /></label>
		<label>Коллекция<StatisticsSelect bind:value={collection} label="Коллекция" items={[{ value: '', label: 'Все коллекции' }, ...visibleCollections.map(c => ({ value: c.slug, label: c.title }))]} /></label>
		<label>Поиск<Input type="search" bind:value={query} placeholder="Найти запись">
			{#snippet render({ props })}
				<input {...props} />
			{/snippet}
		</Input></label>
	</div>
	<div class="summary" aria-live="polite">
		<div><span>Открытия</span><strong>{number(total)}</strong></div>
		<div><span>Записей открыто</span><strong>{number(viewed)}</strong></div>
		<div><span>Всего записей</span><strong>{rows.length}</strong></div>
	</div>
	{#if snapshot && total === 0}<p class="intro">За выбранный период открытий пока нет.</p>{/if}
	{#if snapshot && days.length > 1 && total}
		<div class="chart" role="img" aria-label="Открытия по дням">{#each days as day}<div title={date(day.day) + ' — ' + day.visits} style:height={(day.visits / max) * 100 + '%'}></div>{/each}</div>
		<div class="dates"><span>{date(from)}</span><span>{date(snapshot.endDate)}</span></div>
	{/if}
	<div class="settings"><Collapsible>
	<CollapsibleTrigger>
		{#snippet render({ props })}
			<button {...props} class="disclosure-trigger">Правила и настройки учёта</button>
		{/snippet}
	</CollapsibleTrigger>
	<CollapsiblePanel keepMounted>
		<p>Запись засчитывается после 10 секунд в видимой вкладке. Повторные открытия в этом браузере учитываются раз в 30 минут для каждой записи.</p>
		{#if excluded === null}
			<Button onclick={() => preference()} disabled={savingPreference}>
				{#snippet render({ props })}<button {...props}>Загрузить настройку</button>{/snippet}
			</Button>
		{:else}
			<Toggle pressed={excluded} disabled={savingPreference} onPressedChange={(next, details) => {
				details.cancel();
				void preference(next);
			}}>
				{#snippet render({ props })}<button {...props}>Исключить мои посещения</button>{/snippet}
			</Toggle>
		{/if}
		{#if preferenceError}<p role="alert">{preferenceError}</p>{/if}
	</CollapsiblePanel>
</Collapsible></div>	<div class="table-heading"><h2>Записи</h2><Button onclick={download} disabled={!snapshot || !rows.length}>
		{#snippet render({ props })}
			<button {...props}>Экспорт CSV</button>
		{/snippet}
	</Button></div>
	<table>
		<thead><tr><th scope="col">Название</th><th scope="col" class="numeric">Открытия</th></tr></thead>
		<tbody>{#each rows as row}<tr><td><a href="{base}/reports/{row.slug}/">{row.title}</a></td><td class="numeric">{number(row.visits)}</td></tr>{/each}</tbody>
	</table>
	{#if !rows.length}<p>Записей с таким названием в выбранной коллекции нет.</p>{/if}
</div>

<style>
	.disclosure-trigger { text-align: start; font: inherit; color: inherit; background: transparent; border: 0; padding: 0; cursor: pointer; }
	.statistics { padding-block: 32px 64px; max-width: 1100px; }
	.settings { margin-block: 12px 24px; font: 14px/1.5 var(--font-ui); color: var(--ink-soft); } .settings p { max-width: 65ch; }
	.settings .disclosure-trigger { min-height: var(--hit); padding-block: var(--space-2); font: var(--text-control)/1.5 var(--font-ui); cursor: pointer; color: var(--ink-soft); }
	header, .table-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-block: 16px; }
	h1 { font-size: clamp(30px, 4vw, 48px); margin: 0; }
	h2 { margin: 0; font-size: 26px; }
	.status { color: var(--ink-soft); max-width: 72ch; font: 15px/1.55 var(--font-ui); }
	.status { margin-block: -8px 18px; font-variant-numeric: tabular-nums; }
	button, input { font: 16px/1.4 var(--font-ui); color: var(--ink); background: var(--paper); min-height: 44px; border: 1px solid var(--edge); border-radius: var(--radius); padding: 8px 10px; }
	button { cursor: pointer; }
	button[data-pressed] { background: var(--accent); color: var(--on-action); }
	button:disabled { opacity: .55; cursor: default; }
	.filters { display: grid; grid-template-columns: 150px minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-block: 16px; }
	label { display: grid; gap: 6px; font: 14px/1.4 var(--font-ui); color: var(--ink-soft); }
	input { width: 100%; min-width: 0; }
	.summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--line); border-block: 1px solid var(--line); margin-block: 24px 16px; }
	.summary > div { background: var(--paper-2); padding: 16px clamp(8px, 2vw, 24px); display: flex; flex-direction: column-reverse; justify-content: end; } .summary > div:first-child strong { color: var(--accent); } .summary span { display: block; color: var(--ink-soft); font: 14px/1.5 var(--font-ui); }
	.summary strong { font: 42px/1.1 var(--font-display); font-variant-numeric: tabular-nums; }
	.chart { height: 84px; display: flex; align-items: end; gap: 6px; background: repeating-linear-gradient(to top, var(--line) 0 1px, transparent 1px 50%); border-bottom: 1px solid var(--line); }
	.chart div { flex: 1; background: var(--accent); min-width: 0; }
	.dates { margin-top: 4px; font-family: var(--font-ui); display: flex; justify-content: space-between; color: var(--ink-soft); font-size: 12px; }
	table { width: 100%; border-collapse: collapse; }
	th, td { padding: 14px 0; border-bottom: 1px solid var(--line); text-align: left; }
	th { font: 14px/1.5 var(--font-ui); color: var(--ink-soft); }
	td a { color: var(--ink); }
	td a:hover { text-decoration: underline; }
	.numeric { text-align: right; padding-left: 16px; font-variant-numeric: tabular-nums; }
	@media(max-width: 600px) { .filters { grid-template-columns: 1fr; } .summary span { font-size: 12px; } .summary strong { font-size: 30px; } }
</style>

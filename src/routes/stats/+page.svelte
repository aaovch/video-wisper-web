<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { getAllReportSummaries } from '$lib/data/report-meta';
	import { collections } from '$lib/data/collections';
	import { parseSnapshot, periodStart, periodVisits, csvCell, type AnalyticsSnapshot } from '$lib/analytics';
	import { GOATCOUNTER_URL } from '$lib/goatcounter';
	import legacy from '$lib/data/legacy-analytics.json';
	const legacyBySlug = new Map(legacy.rows.map(row=>[row.slug,row.visits]));

	const publicCollections = collections.filter(c => !c.catalogHidden && !c.isolated);
	const reports = getAllReportSummaries().filter(r => publicCollections.some(c => c.items.includes(r.slug)));
	let snapshot = $state<AnalyticsSnapshot | null>(null);
	let loading = $state(true);
	let failed = $state(false);
	let query = $state('');
	let collection = $state('');
	let author = $state('');
	let area = $state('all');
	let period = $state('30');
	let sort = $state('legacy');
	let ascending = $state(false);
	const authors = [...new Set(publicCollections.flatMap(c => c.facets?.authors ?? []))].sort((a,b) => a.localeCompare(b,'ru'));
	const end = $derived(snapshot?.endDate ?? '');
	const from = $derived(snapshot ? period === 'all' ? snapshot.startDate : [snapshot.startDate, periodStart(end, Number(period))].sort().at(-1)! : '');
	const partialPeriod = $derived(snapshot && period !== 'all' && periodStart(end, Number(period)) < snapshot.startDate);
	const filtered = $derived(Boolean(query.trim() || collection || author || area !== 'all'));
	const selection = $derived([
		query.trim() ? `Поиск: ${query.trim()}` : '',
		publicCollections.find(c => c.slug === collection)?.title ?? '',
		author,
		area === 'archive' ? 'Архив' : area === 'main' ? 'Основной каталог' : ''
	].filter(Boolean).join(' · '));
	const rows = $derived.by(() => {
		const bySlug = new Map(snapshot?.rows.map(row => [row.slug, row]) ?? []);
		return reports.map(report => {
			const memberships = publicCollections.filter(c => c.items.includes(report.slug));
			const data = bySlug.get(report.slug);
			return { ...report, memberships, legacyVisits:legacyBySlug.get(report.slug) ?? null, visits: snapshot ? period === 'all' ? data?.visits ?? null : periodVisits(data, from, end) : null };
		}).filter(row => (!query || row.title.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))) &&
			(!collection || row.memberships.some(c => c.slug === collection)) &&
			(!author || row.memberships.some(c => c.facets?.authors?.includes(author))) &&
			(area === 'all' || row.memberships.some(c => Boolean(c.archived) === (area === 'archive'))))
		.sort((a,b) => {
			const av=sort==='legacy'?a.legacyVisits:a.visits, bv=sort==='legacy'?b.legacyVisits:b.visits;
			if (sort !== 'title' && (av === null || bv === null)) return av === bv ? a.title.localeCompare(b.title,'ru') : av === null ? 1 : -1;
			const value = sort === 'title' ? a.title.localeCompare(b.title,'ru') : (av ?? 0) - (bv ?? 0);
			return (ascending ? value : -value) || a.slug.localeCompare(b.slug);
		});
	});
	const total = $derived(snapshot ? rows.reduce((sum,row) => sum + (row.visits ?? 0),0) : null);
	const legacyTotal = $derived(rows.reduce((sum,row)=>sum+(row.legacyVisits ?? 0),0));
	const viewed = $derived(snapshot ? rows.filter(row => (row.visits ?? 0) > 0).length : null);
	const missing = $derived(snapshot ? rows.filter(row => row.visits === null).length : 0);
	const chart = $derived.by(() => {
		if (!snapshot) return [];
		const selected = new Set(rows.map(row => row.slug));
		const days = new Map<string,number>();
		for (let day = from; day <= end; day = periodStart(day,0)) days.set(day,0);
		for (const row of snapshot.rows) if (selected.has(row.slug)) for (const point of row.daily)
			if (days.has(point.day)) days.set(point.day,days.get(point.day)! + point.visits);
		return [...days].map(([day, visits]) => ({day, visits}));
	});
	const maximum = $derived(Math.max(1,...chart.map(point => point.visits)));
	const noNewVisits = $derived(snapshot && snapshot.rows.every(row => row.visits === 0));
	const stale = $derived(snapshot ? Date.now() - Date.parse(snapshot.generatedAt) > 48*3600000 : false);
	const format = (n: number | null) => n === null ? '—' : n.toLocaleString('ru-RU');
	function changeSort(value: string) { if (sort === value) ascending = !ascending; else { sort = value; ascending = value === 'title'; } }
	function resetFilters() { query = ''; collection = ''; author = ''; area = 'all'; }
	const formatDay = (day: string) => day.split('-').reverse().join('.');
	async function load() {
		loading = true; failed = false;
		try {
			const response = await fetch(`${base}/analytics/summary.json`, { cache: 'no-cache' });
			if (!response.ok) throw new Error('Unavailable');
			snapshot = parseSnapshot(await response.json());
		} catch { failed = true; }
		finally { loading = false; }
	}
	function downloadCsv() {
		const content = [['Материал','Коллекции','GoatCounter за период','Начало периода','Конец периода','До перехода (Page Views API)','Снимок старых данных'], ...rows.map(row =>
			[row.title,row.memberships.map(c=>c.title).join(' / '),row.visits ?? '',from,end,row.legacyVisits ?? '',legacy.capturedAt])]
			.map(row=>row.map(csvCell).join(';')).join('\r\n');
		const url = URL.createObjectURL(new Blob(['\uFEFF',content], {type:'text/csv;charset=utf-8'}));
		const link = document.createElement('a'); link.href=url; link.download=`video-wisper-${from || 'history'}-${end || legacy.capturedAt.slice(0,10)}.csv`; link.click();
		setTimeout(()=>URL.revokeObjectURL(url),1000);
	}
	onMount(() => { void load(); });
</script>

<svelte:head><title>Статистика — Video Wisper</title><meta name="robots" content="noindex" /></svelte:head>

<div class="container statistics">
	<nav class="navigation" aria-label="Раздел каталога"><a href="{base}/">Каталог</a><a href="{base}/archive/">Архив</a><a href="{base}/stats/" aria-current="page">Статистика</a></nav>
	<div class="heading"><div><p class="label">Интерес к материалам</p><h1>Статистика</h1></div><a class="dashboard" href={GOATCOUNTER_URL} target="_blank" rel="noopener noreferrer">Кабинет GoatCounter ↗</a></div>
	<p class="intro">Какие отчёты открывают и как меняется интерес к ним. Повторные открытия учитываются по правилам GoatCounter; запуск видео и время просмотра сюда не входят.</p>
	{#if failed}<div class="notice" role="status"><strong>Статистика пока недоступна.</strong><p>Отчёты показаны ниже. Сбор данных и выгрузка должны быть подключены; отсутствие данных не означает ноль посещений.</p><button onclick={load} disabled={loading}>Повторить загрузку</button></div>{/if}
	<div class="filters">
		<label for="stats-period">Период</label><select id="stats-period" bind:value={period} aria-describedby="period-help"><option value="7">7 дней</option><option value="30">30 дней</option><option value="all">С начала учёта</option></select>
		<label for="stats-query">Поиск</label><input id="stats-query" type="search" bind:value={query} placeholder="Название материала" />
		<label for="stats-collection">Коллекция</label><select id="stats-collection" bind:value={collection}><option value="">Все коллекции</option>{#each publicCollections as c}<option value={c.slug}>{c.title}</option>{/each}</select>
		<label for="stats-author">Автор</label><select id="stats-author" bind:value={author}><option value="">Все авторы</option>{#each authors as name}<option value={name}>{name}</option>{/each}</select>
		<label for="stats-area">Раздел</label><select id="stats-area" bind:value={area}><option value="all">Весь каталог</option><option value="main">Основной каталог</option><option value="archive">Архив</option></select>
	</div>
	<div class="filter-result" aria-live="polite"><p><strong>Показано {rows.length} из {reports.length} материалов</strong>{#if filtered}<span>{selection}</span>{/if}</p>{#if filtered}<button onclick={resetFilters}>Сбросить фильтры</button>{/if}</div>
	<div id="period-help" class="period-help">
		{#if snapshot}
			{#if partialPeriod}<p><strong>Выбрано {period} дней, но учёт ведётся только с {formatDay(snapshot.startDate)}.</strong> Данные доступны за {formatDay(from)} — {formatDay(end)}. Пока история короче выбранных периодов, их итоги могут совпадать.</p>{/if}
			{#if noNewVisits}<p>В текущей выгрузке ещё нет новых посещений материалов. Обновление — ежедневно в 08:23 по Кызылорде; свежие посещения можно посмотреть в кабинете GoatCounter.</p>{/if}
		{/if}
		<p>Период меняет колонку «За период» и график. Колонка «Ранее» — сохранённый общий итог без дат.</p>
	</div>
	<div class="summary" aria-live="polite" aria-busy={loading}><div><span>GoatCounter за период</span><strong>{format(total)}</strong></div><div><span>До перехода</span><strong>{format(legacyTotal)}</strong></div><div><span>С посещениями за период</span><strong>{format(viewed)}</strong></div><div><span>Материалы в выборке</span><strong>{rows.length}</strong></div></div>
	<p class="freshness">Старые счётчики сохранены {new Date(legacy.capturedAt).toLocaleString('ru-RU',{timeZone:'Asia/Qyzylorda'})} (Кызылорда). Колонка «Ранее» содержит весь накопленный итог и не зависит от выбранного периода.</p>
	{#if snapshot}<p class="freshness">Период: {from} — {end} (Кызылорда, UTC+5). Сбор с {snapshot.startDate}. Обновлено {new Date(snapshot.generatedAt).toLocaleString('ru-RU',{timeZone:snapshot.timezone})}.{#if stale} <strong>Данные старше двух суток.</strong>{/if}{#if missing} <strong>Для {missing} материалов ещё нет выгрузки; итоги включают только известные значения.</strong>{/if}</p>{/if}
	{#if chart.length}<section aria-labelledby="trend-title"><h2 id="trend-title">Посещения по дням</h2><div class="chart" style={`gap:${chart.length>90 ? 0 : 3}px`} role="img" aria-label={`Посещения по дням, ${from} — ${end}. Всего ${total}.`}>
		{#each chart as point}<div class="bar" title={`${point.day}: ${point.visits}`} style={`height:${Math.max(1,point.visits/maximum*100)}%`}><span class="sr-only">{point.day}: {point.visits}</span></div>{/each}
	</div><div class="chart-dates"><span>{from}</span><span>{end}</span></div></section>{/if}
	<div class="table-heading"><h2>Материалы</h2><button onclick={downloadCsv}>Скачать CSV</button></div>
	<div class="table-wrap"><table><caption class="sr-only">Посещения за выбранный период GoatCounter и старые накопленные счётчики</caption><thead><tr><th scope="col" aria-sort={sort==='title' ? ascending ? 'ascending' : 'descending' : undefined}><button onclick={()=>changeSort('title')}>Материал {sort==='title' ? ascending ? '↑' : '↓' : '↕'}</button></th><th scope="col">Коллекции</th><th scope="col" class="numeric" aria-sort={sort==='visits' ? ascending ? 'ascending' : 'descending' : undefined}><button onclick={()=>changeSort('visits')}>За период {sort==='visits' ? ascending ? '↑' : '↓' : '↕'}</button></th><th scope="col" class="numeric" aria-sort={sort==='legacy' ? ascending ? 'ascending' : 'descending' : undefined}><button onclick={()=>changeSort('legacy')}>Ранее {sort==='legacy' ? ascending ? '↑' : '↓' : '↕'}</button></th></tr></thead><tbody>
		{#each rows as row (row.slug)}<tr><td><a href="{base}/reports/{row.slug}/">{row.title}</a></td><td>{row.memberships.map(c=>c.title).join(' · ')}</td><td class="numeric">{format(row.visits)}</td><td class="numeric">{format(row.legacyVisits)}</td></tr>{:else}<tr><td colspan="4">Материалы не найдены. Измените поиск или фильтры.</td></tr>{/each}
	</tbody></table></div>
	<p class="footnote">Сумма посещений материалов не равна числу людей. Каждый материал в общем итоге учитывается один раз, даже если входит в несколько коллекций. Исторические счётчики на страницах отчётов относятся к прежнему сервису и не прибавляются к этим данным.</p>
</div>

<style>
	.statistics { padding-block: 36px 64px; }
	.navigation { display:flex; gap:24px; margin-bottom:32px; font-family:var(--font-mono); font-size:13px; flex-wrap:wrap; }
	.navigation a[aria-current] { color:var(--accent); text-decoration:underline; text-underline-offset:6px; }
	.heading,.table-heading { display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap; }
	h1 { font-size:clamp(36px,6vw,64px); margin:0; }
	h2 { font-size:26px; }
	.intro,.footnote { max-width:82ch; color:var(--ink-soft); }
	.dashboard,.freshness,.footnote { font-size:14px; }
	.filters { display:grid; grid-template-columns: .7fr 1.4fr 1.3fr 1fr 1fr; grid-template-rows:auto auto; grid-auto-flow:column; gap:8px 16px; margin:28px 0 16px; }
	.filter-result { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
	.filter-result p { margin:0; }
	.filter-result span { display:block; color:var(--ink-soft); font-size:14px; margin-top:4px; }
	.period-help { background:var(--paper-3); border-left:3px solid var(--accent); padding:12px 16px; margin-bottom:20px; font-size:14px; }
	.period-help p { margin:0; }
	.period-help p + p { margin-top:8px; }
	label { display:flex; flex-direction:column; gap:8px; font-family:var(--font-mono); font-size:12px; min-width:0; }
	input,select,button { font:inherit; color:var(--ink); background:var(--paper); border:1px solid var(--line-strong); border-radius:var(--radius); padding:10px 12px; min-height:44px; }
	input,select { width:100%; min-width:0; }
	button { cursor:pointer; }
	button:disabled { cursor:default; opacity:.55; }
	:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
	.summary { display:grid; grid-template-columns:repeat(4,1fr); border-block:1px solid var(--line-strong); padding:20px 0; gap:20px; }
	.summary span { display:block; font-size:15px; color:var(--ink-soft); }
	.summary strong { font:36px var(--font-display); font-variant-numeric:tabular-nums; }
	.notice { padding:18px; background:var(--paper-3); border-left:3px solid var(--accent); }
	.notice p { margin:8px 0 12px; }
	.chart { display:flex; gap:3px; align-items:flex-end; height:140px; border-bottom:1px solid var(--line-strong); }
	.bar { flex:1; min-width:0; background:var(--accent); border-radius:2px 2px 0 0; }
	.chart-dates { display:flex; justify-content:space-between; font-size:12px; color:var(--ink-faint); }
	.table-heading { margin-top:28px; }
	.table-wrap { overflow-x:auto; }
	table { border-collapse:collapse; width:100%; font-size:16px; }
	th,td { text-align:left; padding:15px 12px; border-bottom:1px solid var(--line); }
	th:first-child,td:first-child { padding-left:0; width:52%; }
	th { font-size:13px; font-family:var(--font-mono); }
	th button { border:0; padding:0; background:transparent; text-align:inherit; }
	.numeric { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
	td:nth-child(2) { color:var(--ink-soft); font-size:14px; }
	@media(max-width:900px) { .filters { grid-template-columns:repeat(2,1fr); grid-template-rows:repeat(6,auto); } }
	@media(max-width:540px) { .statistics { padding-block:24px 40px; } .summary { grid-template-columns:1fr; gap:14px; } .summary div { display:flex; justify-content:space-between; align-items:center; gap:12px; } .summary strong { font-size:28px; } .filters { grid-template-columns:1fr; grid-template-rows:none; grid-auto-flow:row; } .filters label:not(:first-child) { margin-top:8px; } th,td { padding:12px 5px; } td:nth-child(2),th:nth-child(2) { display:none; } th:first-child,td:first-child { width:60%; } table { font-size:15px; } th { font-size:11px; } }
</style>

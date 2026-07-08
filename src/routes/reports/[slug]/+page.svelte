<script lang="ts">
	import { browser } from '$app/environment';
	import { base } from '$app/paths';
	import ChapterCard from '$lib/components/ChapterCard.svelte';
	import ChapterNav from '$lib/components/ChapterNav.svelte';
	import ReportSearch from '$lib/components/ReportSearch.svelte';
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';
	import Lock from '$lib/components/Lock.svelte';
	import VisitCounter from '$lib/components/VisitCounter.svelte';
	import { reveal } from '$lib/attachments';
	import { reportGate } from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';
	import { SITE_NAME } from '$lib/site';
	import { formatTime } from '$lib/utils';
	import type { SearchHit } from '$lib/search';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const report = $derived(data.report);
	const gate = $derived(reportGate(report.slug));
	const locked = $derived(gate.length > 0 && !gate.some((c) => lock.isUnlocked(c.slug)));

	let seekTo = $state(0);
	let railEl = $state<HTMLElement | null>(null);
	let playerEl = $state<HTMLElement | null>(null);
	let playerComp = $state<{ seekAndPlay?: (t: number) => void } | null>(null);

	// Высота sticky-плеера → отступ для «Содержания», чтобы строки не наслаивались при прокрутке.
	$effect(() => {
		if (!browser || !playerEl || !railEl) return;
		const mq = window.matchMedia('(max-width: 960px)');
		const sync = () => {
			if (!railEl) return;
			if (!mq.matches) {
				railEl.style.removeProperty('--mobile-sticky-h');
				return;
			}
			railEl.style.setProperty('--mobile-sticky-h', `${playerEl!.offsetHeight + 8}px`);
		};
		sync();
		const ro = new ResizeObserver(sync);
		ro.observe(playerEl);
		mq.addEventListener('change', sync);
		return () => {
			ro.disconnect();
			mq.removeEventListener('change', sync);
		};
	});

	// --- Подсветка блока по позиции воспроизведения ---
	let activeChapterIndex = $state(-1);
	let videoPlaying = $state(false);
	let playbackStarted = $state(false);
	let scrollIndex = $state(0);
	let transcriptOpen = $state(false);

	const seminarGlossary = [
		{
			term: 'Тэноути',
			definition: 'работа кистей на рукояти: вкручивание и сжатие для контроля клинка.'
		},
		{
			term: 'Заншин',
			definition: 'боеготовность после первого действия, способность сразу реагировать дальше.'
		},
		{
			term: 'Позиционный атакующий',
			definition: 'боец, который давит вперед и ждет момент для сильного действия.'
		},
		{
			term: 'Маневровый атакующий',
			definition: 'боец, который готовит атаку финтами, сменами линий, гвардий и движением.'
		},
		{
			term: 'Позиционный оборонительный',
			definition: 'боец, который держит позицию, экономит движение и провоцирует раннюю атаку.'
		},
		{
			term: 'Маневровый оборонительный',
			definition: 'боец, который защищается через движение, переключение и встречные действия.'
		},
		{
			term: 'Двигательный образ',
			definition: 'внутреннее ощущение и схема правильно выполненного движения.'
		},
		{
			term: 'Сигнал открытия',
			definition: 'момент, по которому атакующий понимает, что можно входить.'
		},
		{
			term: 'Ложное открытие',
			definition: 'открытие без подходящей дистанции или времени для безопасной атаки.'
		}
	];

	const seminarNotes = [
		{
			title: 'Главная идея занятия',
			items: [
				'Петр Васильев начинает курс с темы «Атака проще не бывает»: простая нисходящая атака сверху по голове или рукам.',
				'Смысл занятия не в коллекции приемов, а в качестве одного надежного действия. В бою лучше иметь 2-3 сильные заготовки, чем много редких техник, которые почти не доходят до применения.',
				'Сложные действия нужны позже: они становятся продолжением сильной базы, а не заменяют ее.'
			]
		},
		{
			title: 'Разминка и подготовка тела',
			items: [
				'Разминка строится вокруг осанки, вертикальных прыжков и работы на одной ноге через воображаемый бросок диска.',
				'Цель - не просто разогреться, а подготовить суставы, которые чаще всего страдают у фехтовальщика: плечо, локоть, запястье, колено и голеностоп.',
				'С самого начала Петр связывает технику с безопасностью: хороший удар должен быть не только результативным, но и устойчивым для тела.'
			]
		},
		{
			title: 'Что можно успеть за короткий курс',
			items: [
				'За две недели и несколько занятий нельзя полностью сформировать новый навык, но можно собрать правильный двигательный образ.',
				'Этот образ должен быть конкретным: как стоят ноги, как идут руки, что делают кисти, где плечи, как завершается удар.',
				'Если спортсмен запомнит правильную схему и будет возвращаться к ней на тренировках, со временем она станет настоящим навыком.'
			]
		},
		{
			title: 'Сборка нисходящего удара',
			items: [
				'Базовая форма удара собирается по деталям: фронтальная стойка, прямые руки, сходящиеся предплечья и вкручивание кистей в рукоять.',
				'Тэноути нужно для контроля клинка после попадания. Если пальцы не сжаты и кисти не создают упор, меч отскакивает назад и открывает фехтовальщика для продолжения соперника.',
				'Плечи не должны подниматься к ушам. Кулаки могут быть выше плеч, но нагрузку нужно уводить в широчайшие мышцы спины, а не в мелкие структуры плечевого сустава.',
				'Корпус остается собранным: удар идет далеко вперед, но без провала, лишнего прогиба и потери боеготовности.'
			]
		},
		{
			title: 'Линия, дистанция и заншин',
			items: [
				'Удар должен идти по прямой и без лишнего замаха. Чем проще линия, тем меньше времени сопернику на чтение атаки.',
				'Вход в атаку начинается не от желания «ударить сейчас», а от сигнала открытия: дистанция, момент и положение соперника должны позволять безопасно войти.',
				'Ложное открытие опасно: цель вроде бы видна, но дистанции или времени для нормальной атаки нет.',
				'После удара нужен заншин - готовность продолжать бой: защититься, взять соединение, ответить на движение соперника или выйти из опасной дистанции.'
			]
		},
		{
			title: 'Атака как дилемма',
			items: [
				'Хорошая атака ставит соперника перед неприятным выбором. Если он бездействует, его наказывают прямой атакой. Если реагирует, атакующий использует подготовленное продолжение.',
				'Поэтому прием не должен быть одиночным жестом. Он работает как ситуация, где спортсмен заранее понимает возможные реакции соперника.',
				'Упражнения с монитором учат видеть настоящий момент входа, не кидаться в подарок и не путать открытие с ловушкой.'
			]
		},
		{
			title: 'Переход к индивидуальному стилю',
			items: [
				'После базовой атаки занятие переходит к вопросу: какие действия стоит тренировать именно этому спортсмену.',
				'Петр предлагает простую карту из двух осей: атака или защита, позиционность или маневренность.',
				'Это не ярлык и не окончательный диагноз. Схема нужна, чтобы выбрать приоритеты: что усиливает конкретного бойца, а что будет тратить тренировочное время без большого эффекта.'
			]
		},
		{
			title: 'Четыре рабочих типа',
			items: [
				'Позиционный атакующий давит вперед, бережет простоту и реализует сильные удары через темп, прессинг и точный вход.',
				'Маневровый атакующий обманывает соперника с помощью финтов, смены гвардий, работы клинком и перемещения.',
				'Позиционный оборонительный экономит движение, держит дистанцию, провоцирует ранний вход и наказывает защитой-ответом или контратакой с защитой.',
				'Маневровый оборонительный защищается через отход, смену дистанции и перехват инициативы, а затем может сам перейти в атаку.'
			]
		},
		{
			title: 'Что тренировать разным типам',
			items: [
				'Атакующим типам важно не распыляться: лучше довести до высокого качества свои главные входы и способы подготовки.',
				'Оборонительным типам важно не превращать защиту в пассивность: нужны провокации, ложные открытия, точный момент ответа и готовность забрать инициативу.',
				'Маневровым типам полезнее больше работать с перемещением, сменой картины, клинком и переключениями; позиционным - с дистанцией, терпением, моментом и надежностью основного действия.'
			]
		},
		{
			title: 'Захват и соединение',
			items: [
				'Захват появляется как инструмент для маневрового бойца: он снимает угрозу уколом и заставляет соперника решить, что делать дальше.',
				'Если соперник не реагирует, захват становится подготовкой собственной атаки.',
				'Если соперник атакует в ответ на захват, дистанция и соединение должны дать возможность защититься и ответить.'
			]
		},
		{
			title: 'Финальный вывод',
			items: [
				'База обязательна для всех: безопасная механика удара, контроль дистанции, защита, ответ и боеготовность после действия.',
				'После базы тренировки стоит индивидуализировать. Нельзя одинаково хорошо и одинаково быстро прокачивать все шаги, удары, защиты и гвардии, поэтому нужен приоритет.',
				'Главный ориентир - что делает сильнее именно этого спортсмена: его антропометрия, характер и базовая реакция на стресс.',
				'Стиль не высечен в камне, он может меняться со временем, но выбранная схема помогает понятнее тренироваться уже сейчас.'
			]
		}
	];

	const seminarExercises = [
		{
			title: 'Разминка',
			items: [
				{ start: 280, text: 'Вертикальные прыжки из стойки: корпус ровный, прыжок вверх без лишнего прогиба.' },
				{ start: 313, text: 'Серия прыжков: три низких и один высокий, толчок икрами без сгибания коленей.' },
				{ start: 344, text: 'Прыжки через меч: старт у острия, прыжок в сторону со сменой рук и мягким приседом.' }
			]
		},
		{
			title: 'Сборка удара',
			items: [
				{ start: 548, text: 'Формирование двигательного образа: фронтальная стойка, меч у корпуса, руки выпрямляются вперед.' },
				{ start: 755, text: 'Изоляция плеча без меча: вытянутой рукой стиснуть руку в подмышке и опустить плечо вниз.' },
				{ start: 814, text: 'Удар с контролем плеча: кулак выше плеча, плечо не тянется к уху, крестовина на уровне шеи.' },
				{ start: 1010, text: 'Медленные удары по прямой линии: самостоятельно работать на форму, а не на скорость.' }
			]
		},
		{
			title: 'Дистанция и сигнал',
			items: [
				{ start: 1472, text: 'Упражнение на истинное и ложное открытие: атаковать только когда есть и дистанция, и открытие.' },
				{ start: 1608, text: 'Практика после объяснения: ученик идет вперед, монитор удерживает дистанцию и дает разные сигналы.' }
			]
		},
		{
			title: 'Атакующие типы',
			items: [
				{ start: 2560, text: 'Позиционный атакующий: прессинг, ожидание своей дистанции и атака только на сигнал открытия.' },
				{ start: 2740, text: 'Работа позиционного атакующего: после отскока сразу возвращаться вперед, как на растянутой резинке.' },
				{ start: 3349, text: 'Маневровый атакующий: готовить вход сменой гвардии, финтом, захватом или работой клинком.' },
				{ start: 3426, text: 'Усложнение: монитор иногда сам начинает атаку, ученик переключается на защиту и ответ.' }
			]
		},
		{
			title: 'Оборонительные типы',
			items: [
				{ start: 3875, text: 'Позиционная оборона: монитор идет вперед и дает два сигнала; ученик выбирает защиту-ответ или контратаку с защитой.' },
				{ start: 4228, text: 'Ключевое упражнение обороны: повторить со средней скоростью и честными сигналами монитора.' },
				{ start: 4834, text: 'Маневровая оборона: удерживать дистанцию, ловить смену направления и при необходимости забирать инициативу.' }
			]
		},
		{
			title: 'Захват и соединение',
			items: [
				{ start: 5039, text: 'Дополнение для сильных: на отходе работать захватом и соединением.' },
				{ start: 5105, text: 'Практика захвата: монитор идет по центральной линии, ученик отходит, берет захват и читает реакцию.' }
			]
		},
		{
			title: 'Заминка',
			items: [
				{ start: 5353, text: 'Меч за спину: растяжка трицепса с ровной спиной.' },
				{ start: 5413, text: 'Наклон к мечу на прямых ногах: задняя поверхность бедра.' },
				{ start: 5444, text: '«Зомби / качок»: округление и раскрытие спины.' },
				{ start: 5493, text: 'Прокат на колене вперед-назад: тазобедренный сустав и задняя поверхность бедра.' }
			]
		}
	];

	function onVideoTime(t: number) {
		if (!playbackStarted && t > 0.3) playbackStarted = true;
		const idx = chapterIndexAt(t);
		if (idx !== activeChapterIndex) activeChapterIndex = idx;
	}

	function chapterIndexAt(t: number): number {
		const ch = report.chapters;
		let idx = 0;
		for (let i = 0; i < ch.length; i++) {
			if (ch[i].start <= t + 0.25) idx = i;
			else break;
		}
		return idx;
	}

	// Блок на позиции плеера: держится и на паузе (пока воспроизведение хоть раз начиналось).
	const playingIndex = $derived(playbackStarted ? activeChapterIndex : -1);
	// Активный пункт в «Содержании»: воспроизведение приоритетнее скролла.
	const navActive = $derived(playingIndex >= 0 ? playingIndex : scrollIndex);

	// Скролл-спай: какой блок сейчас в зоне чтения (когда видео не играет).
	$effect(() => {
		const ids = report.chapters.map((_, i) => `ch-${i + 1}`);
		const nodes = ids
			.map((id) => document.getElementById(id))
			.filter((n): n is HTMLElement => Boolean(n));
		if (!nodes.length || typeof IntersectionObserver === 'undefined') return;

		const visible = new Set<number>();
		let scrollTimer: ReturnType<typeof setTimeout> | undefined;
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const idx = Number((entry.target as HTMLElement).dataset.idx);
					if (entry.isIntersecting) visible.add(idx);
					else visible.delete(idx);
				}
				clearTimeout(scrollTimer);
				scrollTimer = setTimeout(() => {
					if (visible.size) scrollIndex = Math.min(...visible);
				}, 120);
			},
			{ rootMargin: '-18% 0px -72% 0px', threshold: 0 }
		);

		nodes.forEach((n, i) => {
			n.dataset.idx = String(i);
			io.observe(n);
		});

		return () => {
			clearTimeout(scrollTimer);
			io.disconnect();
		};
	});

	function seekVideo(start: number) {
		seekTo = start;
		// Синхронно, внутри жеста — иначе на мобильных play() блокируется.
		playerComp?.seekAndPlay?.(start);
		if (window.matchMedia('(max-width: 960px)').matches) {
			playerEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function selectChapter(index: number, start: number) {
		seekVideo(start);
		document.getElementById(`ch-${index + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function onSearchHit(hit: SearchHit) {
		if (hit.chapterIndex != null) {
			selectChapter(hit.chapterIndex, hit.start ?? report.chapters[hit.chapterIndex].start);
			return;
		}
		document.querySelector('.report-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>{report.title} — {SITE_NAME}</title>
	<meta name="description" content={report.subtitle} />
</svelte:head>

{#if locked}
	<Lock
		targets={gate}
		title={report.title}
		subtitle="Это видео из закрытой коллекции. Введите пароль, чтобы открыть доступ."
	/>
{:else}
<article class="report container">
	<div class="layout" class:no-video={!report.video}>
		<!-- Слева: плеер + содержание (sticky с самого верха) -->
		<aside class="rail" bind:this={railEl}>
			{#if report.video}
				<div class="video-pin" bind:this={playerEl}>
					<VideoPlayer
						bind:this={playerComp}
						video={report.video}
						{seekTo}
						onTime={onVideoTime}
						onPlaying={(p) => (videoPlaying = p)}
					/>
					<p class="video-hint label">Клик по блоку — перемотка</p>
				</div>
			{/if}
			<div class="nav-scroll">
				<ReportSearch {report} onHit={onSearchHit} />
				<ChapterNav chapters={report.chapters} onSelect={selectChapter} active={navActive} />
			</div>
		</aside>

		<!-- Справа: заголовок и текст -->
		<div class="content">
			<header class="report-head reveal" {@attach reveal()}>
				<h1>{report.title}</h1>
				<p class="subtitle">{report.subtitle}</p>
				<p class="views label">
					<VisitCounter target={{ kind: 'report', slug: report.slug }} />
				</p>
			</header>

			{#if report.slug === 'gruppa-a-1-vvodnaya'}
				<section class="seminar-materials reveal" aria-label="Материалы семинара" {@attach reveal()}>
					<details class="seminar-glossary">
						<summary>
							<span class="label">Глоссарий семинара</span>
						</summary>
						<dl>
							{#each seminarGlossary as item (item.term)}
								<div>
									<dt>{item.term}</dt>
									<dd>{item.definition}</dd>
								</div>
							{/each}
						</dl>
					</details>

					<details class="seminar-infographic-panel">
						<summary>
							<span class="label">Инфографика семинара</span>
						</summary>
						<figure class="seminar-infographic">
							<img
								src="{base}/media/gruppa-a-1-vvodnaya-infographic.png"
								alt="Инфографика семинара про индивидуальный стиль бойца"
								loading="lazy"
								decoding="async"
							/>
						</figure>
					</details>
				</section>
			{/if}

			<section class="chapters">
				{#each report.chapters as chapter, i (chapter.start)}
					<div class="reveal" {@attach reveal()}>
						<ChapterCard
							{chapter}
							index={i}
							onSeek={report.video ? seekVideo : undefined}
							playing={playingIndex === i}
							live={videoPlaying && playingIndex === i}
						/>
					</div>
				{/each}
			</section>

			{#if report.slug === 'gruppa-a-1-vvodnaya'}
				<section class="seminar-notes-section reveal" aria-label="Конспект семинара" {@attach reveal()}>
					<details class="seminar-notes">
						<summary>
							<span class="label">Конспект семинара</span>
						</summary>
						<div class="seminar-notes-body">
							{#each seminarNotes as section (section.title)}
								<section class="seminar-note-block">
									<h2>{section.title}</h2>
									<ul>
										{#each section.items as item}
											<li>{item}</li>
										{/each}
									</ul>
								</section>
							{/each}
						</div>
					</details>
				</section>

				<section class="seminar-exercises-section reveal" aria-label="Упражнения семинара" {@attach reveal()}>
					<details class="seminar-exercises">
						<summary>
							<span class="label">Упражнения семинара</span>
						</summary>
						<div class="seminar-exercises-body">
							{#each seminarExercises as exerciseSection (exerciseSection.title)}
								<section class="seminar-exercise-block">
									<h2>{exerciseSection.title}</h2>
									<ul>
										{#each exerciseSection.items as exercise}
											<li>
												{#if report.video}
													<button
														type="button"
														class="exercise-time"
														onclick={() => seekVideo(exercise.start)}
														title="Смотреть упражнение с этого момента"
													>
														<span aria-hidden="true">▶</span>
														<span class="mono">{formatTime(exercise.start)}</span>
													</button>
												{:else}
													<span class="exercise-time-static mono">{formatTime(exercise.start)}</span>
												{/if}
												<span>{exercise.text}</span>
											</li>
										{/each}
									</ul>
								</section>
							{/each}
						</div>
					</details>
				</section>
			{/if}

			{#if report.transcript}
				<section class="transcript reveal" {@attach reveal()}>
					<details bind:open={transcriptOpen}>
						<summary><span class="label">Полная расшифровка</span></summary>
						{#if transcriptOpen}
							<p>{report.transcript}</p>
						{/if}
					</details>
				</section>
			{/if}

			<p class="source label">{report.source_name}</p>
		</div>
	</div>
</article>
{/if}

<style>
	.report {
		padding-top: 20px;
		padding-bottom: 48px;
		max-width: 1320px;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(300px, 36%) minmax(0, 1fr);
		gap: clamp(32px, 4vw, 56px);
		align-items: start;
	}

	.layout.no-video {
		grid-template-columns: minmax(240px, 28%) minmax(0, 1fr);
	}

	.rail {
		position: sticky;
		top: 12px;
		align-self: start;
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-height: calc(100vh - 24px);
		min-height: 0;
	}

	.video-pin {
		flex-shrink: 0;
		scroll-margin-top: 12px;
	}

	.nav-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		display: flex;
		flex-direction: column;
		gap: 12px;
		/* Тонкий скроллбар «под бумагу» */
		scrollbar-width: thin;
		scrollbar-color: var(--line-strong) transparent;
	}

	.nav-scroll::-webkit-scrollbar {
		width: 8px;
	}

	.nav-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.nav-scroll::-webkit-scrollbar-thumb {
		background: var(--line-strong);
		border-radius: 999px;
		border: 2px solid var(--paper);
	}

	.nav-scroll::-webkit-scrollbar-thumb:hover {
		background: var(--ink-faint);
	}

	.video-hint {
		margin: 8px 0 0;
		text-align: center;
		font-size: 10px;
	}

	.report-head h1 {
		font-size: clamp(28px, 3.2vw, 44px);
		font-weight: 500;
		margin: 0 0 10px;
		max-width: 22ch;
		line-height: 1.08;
	}

	.subtitle {
		font-size: clamp(17px, 1.6vw, 20px);
		color: var(--ink-soft);
		max-width: 52ch;
		margin: 0;
		line-height: 1.45;
	}

	.views {
		margin: 10px 0 0;
		color: var(--ink-faint);
	}

	.seminar-materials {
		margin-top: 24px;
	}

	.seminar-glossary,
	.seminar-infographic-panel,
	.seminar-notes,
	.seminar-exercises {
		border-bottom: 1px solid var(--line);
	}

	.seminar-glossary {
		border-top: 1px solid var(--line-strong);
	}

	.seminar-glossary summary,
	.seminar-infographic-panel summary,
	.seminar-notes summary,
	.seminar-exercises summary {
		cursor: pointer;
		padding: 16px 0;
		list-style: none;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.seminar-glossary summary::after,
	.seminar-infographic-panel summary::after,
	.seminar-notes summary::after,
	.seminar-exercises summary::after {
		content: '+';
		font-family: var(--font-mono);
		color: var(--accent);
		margin-left: auto;
		font-size: 18px;
	}

	.seminar-glossary[open] summary::after,
	.seminar-infographic-panel[open] summary::after,
	.seminar-notes[open] summary::after,
	.seminar-exercises[open] summary::after {
		content: '−';
	}

	.seminar-glossary summary::-webkit-details-marker,
	.seminar-infographic-panel summary::-webkit-details-marker,
	.seminar-notes summary::-webkit-details-marker,
	.seminar-exercises summary::-webkit-details-marker {
		display: none;
	}

	.seminar-glossary dl {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px 22px;
		margin: 0;
		padding: 0 0 20px;
	}

	.seminar-glossary dl div {
		min-width: 0;
	}

	.seminar-glossary dt {
		font-weight: 600;
		color: var(--ink);
		margin: 0 0 4px;
	}

	.seminar-glossary dd {
		margin: 0;
		color: var(--ink-soft);
		line-height: 1.55;
	}

	.seminar-infographic {
		margin: 20px 0 0;
	}

	.seminar-infographic img {
		display: block;
		width: 100%;
		height: auto;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: #fff;
	}

	.chapters {
		margin-top: 32px;
	}

	.seminar-notes-section {
		margin-top: 40px;
	}

	.seminar-notes {
		border-top: 1px solid var(--line-strong);
	}

	.seminar-notes-body {
		display: grid;
		gap: 22px;
		max-width: var(--measure);
		padding: 2px 0 26px;
	}

	.seminar-note-block h2 {
		margin: 0 0 8px;
		color: var(--ink);
		font-size: 18px;
		line-height: 1.3;
	}

	.seminar-note-block ul {
		display: grid;
		gap: 7px;
		margin: 0;
		padding-left: 20px;
		color: var(--ink-soft);
		font-size: 16px;
		line-height: 1.65;
	}

	.seminar-note-block li::marker {
		color: var(--accent);
	}

	.seminar-exercises-section {
		margin-top: 12px;
	}

	.seminar-exercises {
		border-top: 1px solid var(--line-strong);
	}

	.seminar-exercises-body {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px 24px;
		max-width: var(--measure);
		padding: 2px 0 26px;
	}

	.seminar-exercise-block h2 {
		margin: 0 0 8px;
		color: var(--ink);
		font-size: 17px;
		line-height: 1.3;
	}

	.seminar-exercise-block ul {
		display: grid;
		gap: 6px;
		margin: 0;
		padding-left: 0;
		list-style: none;
		color: var(--ink-soft);
		font-size: 15px;
		line-height: 1.55;
	}

	.seminar-exercise-block li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: baseline;
		gap: 9px;
	}

	.exercise-time,
	.exercise-time-static {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		width: max-content;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		padding: 2px 8px;
		font-size: 11px;
		line-height: 1.35;
		color: var(--ink-soft);
		background: transparent;
	}

	.exercise-time {
		cursor: pointer;
		transition:
			color 0.2s ease,
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.exercise-time:hover {
		color: var(--paper);
		background: var(--accent);
		border-color: var(--accent);
	}

	.exercise-time span[aria-hidden='true'] {
		font-size: 8px;
		color: var(--accent);
		transition: color 0.2s ease;
	}

	.exercise-time:hover span[aria-hidden='true'] {
		color: var(--paper);
	}

	.transcript {
		margin-top: 40px;
	}

	.transcript details {
		border-top: 1px solid var(--line-strong);
	}

	.transcript summary {
		cursor: pointer;
		padding: 16px 0;
		list-style: none;
		display: flex;
		align-items: center;
	}

	.transcript summary::after {
		content: '+';
		font-family: var(--font-mono);
		color: var(--accent);
		margin-left: auto;
		font-size: 18px;
	}

	.transcript details[open] summary::after {
		content: '−';
	}

	.transcript summary::-webkit-details-marker {
		display: none;
	}

	.transcript p {
		margin: 0 0 24px;
		color: var(--ink-soft);
		font-size: 17px;
		line-height: 1.85;
		max-width: var(--measure);
	}

	.source {
		margin: 32px 0 0;
		color: var(--ink-faint);
		word-break: break-all;
	}

	@media (max-width: 960px) {
		.layout,
		.layout.no-video {
			grid-template-columns: 1fr;
			gap: 24px;
		}

		.rail {
			position: static;
			max-height: none;
		}

		.nav-scroll {
			overflow: visible;
			max-height: none;
		}

		.video-pin {
			position: sticky;
			top: 8px;
			z-index: 5;
			background: var(--paper);
			padding-bottom: 4px;
			box-shadow: 0 10px 0 var(--paper);
		}

		.video-hint {
			display: none;
		}

		.report-head h1 {
			max-width: none;
		}

		.seminar-materials {
			margin-top: 20px;
		}

		.seminar-glossary dl {
			grid-template-columns: 1fr;
			gap: 12px;
		}

		.seminar-exercises-body {
			grid-template-columns: 1fr;
			gap: 16px;
		}
	}
</style>

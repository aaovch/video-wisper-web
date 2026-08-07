<script lang="ts">
	import { browser } from '$app/environment';
	import { pushState } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import BookOpenText from 'phosphor-svelte/lib/BookOpenText';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import Cards from 'phosphor-svelte/lib/Cards';
	import Check from 'phosphor-svelte/lib/Check';
	import Clock from 'phosphor-svelte/lib/Clock';
	import CopySimple from 'phosphor-svelte/lib/CopySimple';
	import FilmStrip from 'phosphor-svelte/lib/FilmStrip';
	import ImageSquare from 'phosphor-svelte/lib/ImageSquare';
	import Play from 'phosphor-svelte/lib/Play';
	import TextAlignLeft from 'phosphor-svelte/lib/TextAlignLeft';
	import ChapterCard from '$lib/components/ChapterCard.svelte';
	import ChapterNav from '$lib/components/ChapterNav.svelte';
	import ScopedArchiveSearch from '$lib/components/ScopedArchiveSearch.svelte';
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';
	import Lock from '$lib/components/Lock.svelte';
	import VisitCounter from '$lib/components/VisitCounter.svelte';
	import { reveal } from '$lib/attachments';
	import { collectionsForReport, reportGate } from '$lib/data/collections';
	import { lock } from '$lib/lock.svelte';
	import { SITE_NAME } from '$lib/site';
	import { formatDuration, formatTime } from '$lib/utils';
	import type { SearchHit } from '$lib/search';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const report = $derived(data.report);
	const gate = $derived(reportGate(report.slug));
	const reportCollections = $derived(collectionsForReport(report.slug));
	const locked = $derived(gate.length > 0 && !gate.some((c) => lock.isUnlocked(c.slug)));
	let highlightQuery = $state('');
	let requestedCollectionSlug = $state('');
	const returnCollection = $derived(
		reportCollections.find((collection) => collection.slug === requestedCollectionSlug) ?? reportCollections[0]
	);
	const otherCollections = $derived(reportCollections.filter((collection) => collection.slug !== returnCollection?.slug));

	let seekTo = $state(0);
	let layoutEl = $state<HTMLElement | null>(null);
	let playerEl = $state<HTMLElement | null>(null);
	let playerComp = $state<{ seekAndPlay?: (t: number) => void } | null>(null);
	let appliedUrlSeek = $state('');

	$effect(() => {
		if (!browser) return;
		highlightQuery = page.url.searchParams.get('q') ?? '';
		requestedCollectionSlug = page.url.searchParams.get('from') ?? '';
	});

	// Высота sticky-плеера → отступ для «Содержания», чтобы строки не наслаивались при прокрутке.
	$effect(() => {
		if (!browser || !playerEl || !layoutEl) return;
		const mq = window.matchMedia('(max-width: 960px)');
		const sync = () => {
			if (!layoutEl) return;
			if (!mq.matches) {
				layoutEl.style.removeProperty('--mobile-sticky-h');
				return;
			}
			layoutEl.style.setProperty('--mobile-sticky-h', `${playerEl!.offsetHeight + 8}px`);
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
	let additionalOpen = $state(false);
	let transcriptCopyState = $state<'idle' | 'copied' | 'error'>('idle');
	let transcriptCopyResetTimer: ReturnType<typeof setTimeout> | undefined;
	let activeFocusTab = $state('');
	type MaterialsTab = 'notes' | 'visuals' | 'glossary' | 'transcript';
	let materialsTab = $state<MaterialsTab>('notes');

	// Расшифровка не входит в payload страницы — лениво грузим её из static/.
	const hasTranscript = $derived(Boolean(report.has_transcript));
	let transcriptText = $state('');
	let transcriptLoadState = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let transcriptPromise: Promise<string> | null = null;

	function ensureTranscript(): Promise<string> {
		if (!browser || !hasTranscript) return Promise.resolve('');
		if (transcriptPromise) return transcriptPromise;
		transcriptLoadState = 'loading';
		transcriptPromise = fetch(`${base}/transcripts/${report.slug}.json`)
			.then((response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.json();
			})
			.then((data: { transcript?: string }) => {
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

	async function copyTranscript(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (!browser || !hasTranscript) return;

		try {
			const text = await ensureTranscript();
			if (!text) throw new Error('Empty transcript');
			let copied = false;
			if (navigator.clipboard?.writeText) {
				try {
					await navigator.clipboard.writeText(text);
					copied = true;
				} catch {
					// Встроенный API может быть заблокирован настройками браузера — используем резервный способ ниже.
				}
			}

			if (!copied) {
				const textarea = document.createElement('textarea');
				textarea.value = text;
				textarea.setAttribute('readonly', '');
				textarea.style.position = 'fixed';
				textarea.style.opacity = '0';
				document.body.appendChild(textarea);
				textarea.select();
				copied = document.execCommand('copy');
				textarea.remove();
			}

			if (!copied) throw new Error('Unable to copy transcript');
			transcriptCopyState = 'copied';
		} catch {
			transcriptCopyState = 'error';
		}

		if (transcriptCopyResetTimer) clearTimeout(transcriptCopyResetTimer);
		transcriptCopyResetTimer = setTimeout(() => (transcriptCopyState = 'idle'), 2200);
	}

	// --- Масштаб шрифта расшифровки: длинные тексты читают по-разному ---
	const TRANSCRIPT_SCALE_KEY = 'transcript-scale';
	function readTranscriptScale(): number {
		try {
			const saved = Number(localStorage.getItem(TRANSCRIPT_SCALE_KEY));
			if (saved >= 0.8 && saved <= 1.3) return saved;
		} catch {
			// нет доступа к localStorage — используем базовый размер
		}
		return 1;
	}
	let transcriptScale = $state(browser ? readTranscriptScale() : 1);

	function adjustTranscriptScale(delta: number) {
		transcriptScale = Math.round(Math.min(1.3, Math.max(0.8, transcriptScale + delta)) * 10) / 10;
		try {
			localStorage.setItem(TRANSCRIPT_SCALE_KEY, String(transcriptScale));
		} catch {
			// не критично
		}
	}

	// --- Копирование тезиса цитатой ---
	let copiedQuote = $state('');
	let quoteResetTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyQuote(text: string) {
		const quote = `«${text}» — ${report.title}`;
		let copied = false;
		if (navigator.clipboard?.writeText) {
			try {
				await navigator.clipboard.writeText(quote);
				copied = true;
			} catch {
				// clipboard может быть запрещён — фолбэк ниже
			}
		}
		if (!copied) {
			const textarea = document.createElement('textarea');
			textarea.value = quote;
			textarea.setAttribute('readonly', '');
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			copied = document.execCommand('copy');
			textarea.remove();
		}
		if (!copied) return;
		copiedQuote = text;
		clearTimeout(quoteResetTimer);
		quoteResetTimer = setTimeout(() => (copiedQuote = ''), 1800);
	}

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

	const reportGlossary = $derived(
		report.glossary ?? (report.slug === 'gruppa-a-1-vvodnaya' ? seminarGlossary : [])
	);
	const reportNotes = $derived(
		report.seminar_notes ?? (report.slug === 'gruppa-a-1-vvodnaya' ? seminarNotes : [])
	);
	const reportExercises = $derived(
		report.seminar_exercises ?? (report.slug === 'gruppa-a-1-vvodnaya' ? seminarExercises : [])
	);
	const reportFocusTabs = $derived(report.focus_tabs ?? []);
	const reportInfographic = $derived(
		report.infographic ??
			(report.slug === 'gruppa-a-1-vvodnaya'
				? {
						src: 'media/gruppa-a-1-vvodnaya-infographic.png',
						alt: 'Инфографика семинара про индивидуальный стиль бойца'
					}
				: undefined)
	);
	const reportExerciseMemo = $derived(report.exercise_memo);
	const reportVisualCount = $derived(
		Number(Boolean(reportInfographic)) + Number(Boolean(reportExerciseMemo))
	);
	const hasStudyMaterials = $derived(
		reportNotes.length > 0 ||
			reportVisualCount > 0 ||
			reportGlossary.length > 0
	);
	const activeMaterialsTab = $derived(
		materialsTab === 'notes' && reportNotes.length > 0
			? 'notes'
			: materialsTab === 'visuals' && reportVisualCount > 0
				? 'visuals'
				: materialsTab === 'glossary' && reportGlossary.length > 0
					? 'glossary'
					: materialsTab === 'transcript' && hasTranscript
						? 'transcript'
						: reportNotes.length > 0
							? 'notes'
							: reportVisualCount > 0
								? 'visuals'
								: reportGlossary.length > 0
									? 'glossary'
									: 'transcript'
	);
	const hasAdditional = $derived(
		reportFocusTabs.length > 0 ||
			reportExercises.length > 0 ||
			reportNotes.length > 0 ||
			reportGlossary.length > 0 ||
			Boolean(reportInfographic) ||
			Boolean(reportExerciseMemo) ||
			hasTranscript
	);

	// Пользователь открыл вкладку/спойлер расшифровки — подтягиваем текст.
	$effect(() => {
		if (!browser || !hasTranscript) return;
		if (activeMaterialsTab === 'transcript' || transcriptOpen) {
			void ensureTranscript().catch(() => {});
		}
	});

	function availableMaterialsTabs(): MaterialsTab[] {
		const tabs: MaterialsTab[] = [];
		if (reportNotes.length > 0) tabs.push('notes');
		if (reportVisualCount > 0) tabs.push('visuals');
		if (reportGlossary.length > 0) tabs.push('glossary');
		if (hasTranscript) tabs.push('transcript');
		return tabs;
	}

	function selectMaterialsTab(tab: MaterialsTab) {
		materialsTab = tab;
	}

	function handleMaterialsTabKeydown(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		const tabs = availableMaterialsTabs();
		if (tabs.length < 2) return;
		event.preventDefault();
		const currentIndex = Math.max(0, tabs.indexOf(activeMaterialsTab));
		const nextIndex =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? tabs.length - 1
					: (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
		const nextTab = tabs[nextIndex];
		materialsTab = nextTab;
		queueMicrotask(() => document.getElementById(`materials-tab-${nextTab}`)?.focus());
	}

	$effect(() => {
		if (!reportFocusTabs.length) {
			activeFocusTab = '';
			return;
		}
		if (!reportFocusTabs.some((tab) => tab.id === activeFocusTab)) {
			activeFocusTab = reportFocusTabs[0].id;
		}
	});

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

	// Ссылки из глобального поиска могут сразу открыть нужный блок и таймкод.
	$effect(() => {
		if (!browser || !report.video || !playerComp) return;
		const raw = page.url.searchParams.get('t') ?? '';
		if (!raw || raw === appliedUrlSeek) return;
		const target = Number(raw);
		if (!Number.isFinite(target) || target < 0) return;
		appliedUrlSeek = raw;
		seekTo = target;
		activeChapterIndex = chapterIndexAt(target);
		playbackStarted = true;
		setTimeout(() => playerComp?.seekAndPlay?.(target), 0);
	});

	// Прямая ссылка на дополнительные материалы должна раскрывать свернутый блок.
	$effect(() => {
		if (browser && page.url.hash === '#additional-title') additionalOpen = true;
	});

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
		activeChapterIndex = chapterIndexAt(start);
		playbackStarted = true;
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

	function onSearchHit(hit: SearchHit, seek: boolean, href: string) {
		pushState(href, {});
		if (hit.chapterIndex != null) {
			const target = seek
				? Math.ceil(hit.start ?? report.chapters[hit.chapterIndex].start)
				: hit.start ?? report.chapters[hit.chapterIndex].start;
			if (seek) seekVideo(target);
			document.getElementById(`ch-${hit.chapterIndex + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			return;
		}
		if (hit.zone === 'additional') {
			additionalOpen = true;
			requestAnimationFrame(() => {
				document.getElementById('additional-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
			return;
		}
		if (hit.zone === 'theses') {
			document.getElementById('overview-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			return;
		}
		document.querySelector('.report-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>{report.title} — {SITE_NAME}</title>
	<meta name="description" content={report.subtitle} />
	<meta property="og:type" content="article" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={report.title} />
	<meta property="og:description" content={report.subtitle} />
	<meta name="twitter:card" content="summary" />
</svelte:head>

{#if locked}
	<Lock
		targets={gate}
		title={report.title}
		subtitle="Этот отчёт входит в закрытую коллекцию. Введите пароль, чтобы открыть доступ."
	/>
{:else}
<article class="report container">
	<header class="report-head reveal" {@attach reveal()}>
		<nav class="breadcrumbs" aria-label="Хлебные крошки">
			{#if !returnCollection?.isolated}
				<a href="{base}/">Архив</a><span aria-hidden="true">/</span>
			{/if}
			{#if returnCollection}
				<a href="{base}/collections/{returnCollection.slug}/">{returnCollection.title}</a><span aria-hidden="true">/</span>
			{/if}
			<span>{report.title}</span>
		</nav>
		<p class="eyebrow label">Отчёт</p>
		<h1>{report.title}</h1>
		<p class="subtitle">{report.subtitle}</p>
		<div class="report-meta">
			<span><Clock size={18} /> {formatDuration(report.duration)}</span>
			<span><FilmStrip size={18} /> {report.chapters.length} смысловых блоков</span>
			<span class="views"><VisitCounter target={{ kind: 'report', slug: report.slug }} /></span>
		</div>
		{#if otherCollections.length && !returnCollection?.isolated}
			<p class="memberships label">Также в коллекциях:
				{#each otherCollections as collection, i (collection.slug)}
					<a href="{base}/collections/{collection.slug}/">{collection.title}</a>{i < otherCollections.length - 1 ? ', ' : ''}
				{/each}
			</p>
		{/if}
	</header>

	<div class="layout" class:no-video={!report.video} bind:this={layoutEl}>
		<aside class="rail">
			{#if report.video}
				<div class="video-pin" class:playback-started={playbackStarted} bind:this={playerEl}>
					<VideoPlayer
						bind:this={playerComp}
						video={report.video}
						{seekTo}
						autoplay={playbackStarted}
						onTime={onVideoTime}
						onPlaying={(p) => {
							videoPlaying = p;
							if (p) playbackStarted = true;
						}}
					/>
					<p class="video-hint label">Таймкод в блоке перематывает видео</p>
				</div>
			{/if}
			<div class="nav-scroll">
				<ChapterNav chapters={report.chapters} onSelect={selectChapter} active={navActive} />
			</div>
		</aside>

		<div class="content">
			<div class="scoped-search-wrap reveal" {@attach reveal()}>
				<ScopedArchiveSearch
					kind="report"
					reportSlug={report.slug}
					reportSlugs={returnCollection?.items ?? [report.slug]}
					collectionSlug={returnCollection?.slug ?? ''}
					onHit={onSearchHit}
				/>
			</div>

			<div class="top-sections">
			{#snippet fontControls()}
				<span class="font-controls" role="group" aria-label="Размер шрифта расшифровки">
					<button
						type="button"
						onclick={() => adjustTranscriptScale(-0.1)}
						disabled={transcriptScale <= 0.8}
						aria-label="Уменьшить шрифт"
					>A−</button>
					<button
						type="button"
						onclick={() => adjustTranscriptScale(0.1)}
						disabled={transcriptScale >= 1.3}
						aria-label="Увеличить шрифт"
					>A+</button>
				</span>
			{/snippet}

			{#snippet thesisItem(thesis: string)}
				<li>
					<span class="thesis-text">{thesis}</span>
					<button
						type="button"
						class="copy-quote"
						class:copied={copiedQuote === thesis}
						onclick={() => copyQuote(thesis)}
						aria-label={copiedQuote === thesis ? 'Тезис скопирован' : 'Скопировать тезис цитатой'}
						title={copiedQuote === thesis ? 'Скопировано' : 'Скопировать цитатой'}
					>
						{#if copiedQuote === thesis}<Check size={14} weight="bold" />{:else}<CopySimple size={14} />{/if}
					</button>
				</li>
			{/snippet}

			<section class="overview reveal" aria-labelledby="overview-title" {@attach reveal()}>
				<div class="section-heading section-heading--plain"><h2 id="overview-title">Главное</h2></div>
				<ul>
					{#each report.overview_theses.slice(0, 3) as thesis (thesis)}{@render thesisItem(thesis)}{/each}
				</ul>
				{#if report.overview_theses.length > 3}
					<details class="more-theses">
						<summary>Все тезисы <CaretDown size={16} /></summary>
						<ul>{#each report.overview_theses.slice(3) as thesis (thesis)}{@render thesisItem(thesis)}{/each}</ul>
					</details>
				{/if}
				<span class="sr-only" role="status" aria-live="polite">{copiedQuote ? 'Тезис скопирован' : ''}</span>
			</section>

			{#if hasAdditional}
				<section class="additional" aria-labelledby="additional-title">
					<details class="additional-disclosure" bind:open={additionalOpen}>
						<summary id="additional-title" class="additional-summary">
							<span class="additional-title" role="heading" aria-level="2">Материалы лекции</span>
							<span class="additional-summary-action">
								<span>{additionalOpen ? 'Свернуть' : 'Раскрыть'}</span>
								<CaretDown size={18} aria-hidden="true" />
							</span>
						</summary>
						<div class="additional-content">

			{#if reportFocusTabs.length > 0}
				<section class="focus-section reveal extra-block" aria-label="Тематические срезы" {@attach reveal()}>
					<h3 class="extra-title">Тематические срезы</h3>
					<div class="focus-tablist" role="tablist">
						{#each reportFocusTabs as tab (tab.id)}
							<button
								type="button"
								class:active={activeFocusTab === tab.id}
								role="tab"
								aria-selected={activeFocusTab === tab.id}
								aria-controls={`focus-${tab.id}`}
								id={`focus-tab-${tab.id}`}
								onclick={() => (activeFocusTab = tab.id)}
							>
								{tab.title}
							</button>
						{/each}
					</div>

					{#each reportFocusTabs as tab (tab.id)}
						{#if activeFocusTab === tab.id}
							<div
								class="focus-panel"
								id={`focus-${tab.id}`}
								role="tabpanel"
								aria-labelledby={`focus-tab-${tab.id}`}
							>
								{#if tab.intro?.length}
									<div class="focus-intro">
										{#each tab.intro as item}
											<p>{item}</p>
										{/each}
									</div>
								{/if}
								<div class="focus-items">
									{#each tab.items as item (item.start)}
										<article class="focus-item">
											<header>
												{#if report.video}
													<button
														type="button"
														class="focus-time"
														onclick={() => seekVideo(item.start)}
													title="Смотреть с этого момента"
												>
													<Play size={11} weight="fill" aria-hidden="true" />
														<span class="mono">{formatTime(item.start)}</span>
													</button>
												{:else}
													<span class="focus-time focus-time-static mono">{formatTime(item.start)}</span>
												{/if}
												<h2>{item.title}</h2>
											</header>
											<p>{item.summary}</p>
											{#if item.theses.length}
												<ul>
													{#each item.theses as thesis}
														<li>{thesis}</li>
													{/each}
												</ul>
											{/if}
										</article>
									{/each}
								</div>
							</div>
						{/if}
					{/each}
				</section>
			{/if}

			{#if reportExercises.length > 0}
				<section class="seminar-exercises-section reveal extra-block" aria-label="Упражнения семинара" {@attach reveal()}>
					<details class="seminar-exercises">
						<summary><span>Упражнения</span><CaretDown size={17} /></summary>
						<div class="seminar-exercises-body">
							{#each reportExercises as exerciseSection (exerciseSection.title)}
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
												<Play size={11} weight="fill" aria-hidden="true" />
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

			{#if hasStudyMaterials}
				<section class="study-materials reveal extra-block" aria-label="Материалы лекции" {@attach reveal()}>
					<div class="materials-tablist" role="tablist" aria-label="Разделы материалов">
						{#if reportNotes.length > 0}
							<button
								id="materials-tab-notes"
								type="button"
								role="tab"
								class:active={activeMaterialsTab === 'notes'}
								aria-selected={activeMaterialsTab === 'notes'}
								aria-controls="materials-panel-notes"
								tabindex={activeMaterialsTab === 'notes' ? 0 : -1}
								onclick={() => selectMaterialsTab('notes')}
								onkeydown={handleMaterialsTabKeydown}
							>
								<BookOpenText size={17} aria-hidden="true" />
								<span>Конспект</span>
								<span class="materials-tab-count">{reportNotes.length}</span>
							</button>
						{/if}
						{#if reportVisualCount > 0}
							<button
								id="materials-tab-visuals"
								type="button"
								role="tab"
								class:active={activeMaterialsTab === 'visuals'}
								aria-selected={activeMaterialsTab === 'visuals'}
								aria-controls="materials-panel-visuals"
								tabindex={activeMaterialsTab === 'visuals' ? 0 : -1}
								onclick={() => selectMaterialsTab('visuals')}
								onkeydown={handleMaterialsTabKeydown}
							>
								<ImageSquare size={17} aria-hidden="true" />
								<span>{reportVisualCount === 1 ? 'Памятка' : 'Памятки'}</span>
								{#if reportVisualCount > 1}<span class="materials-tab-count">{reportVisualCount}</span>{/if}
							</button>
						{/if}
						{#if reportGlossary.length > 0}
							<button
								id="materials-tab-glossary"
								type="button"
								role="tab"
								class:active={activeMaterialsTab === 'glossary'}
								aria-selected={activeMaterialsTab === 'glossary'}
								aria-controls="materials-panel-glossary"
								tabindex={activeMaterialsTab === 'glossary' ? 0 : -1}
								onclick={() => selectMaterialsTab('glossary')}
								onkeydown={handleMaterialsTabKeydown}
							>
								<Cards size={17} aria-hidden="true" />
								<span>Глоссарий</span>
								<span class="materials-tab-count">{reportGlossary.length}</span>
							</button>
						{/if}
						{#if hasTranscript}
							<button
								id="materials-tab-transcript"
								type="button"
								role="tab"
								class:active={activeMaterialsTab === 'transcript'}
								aria-selected={activeMaterialsTab === 'transcript'}
								aria-controls="materials-panel-transcript"
								tabindex={activeMaterialsTab === 'transcript' ? 0 : -1}
								onclick={() => selectMaterialsTab('transcript')}
								onkeydown={handleMaterialsTabKeydown}
							>
								<TextAlignLeft size={17} aria-hidden="true" />
								<span>Расшифровка</span>
							</button>
						{/if}
					</div>

					{#if activeMaterialsTab === 'notes'}
						<div id="materials-panel-notes" class="materials-panel" role="tabpanel" aria-labelledby="materials-tab-notes">
							<header class="materials-panel-head">
								<span class="materials-panel-kicker"><BookOpenText size={16} aria-hidden="true" /> Короткий конспект</span>
								<span>{reportNotes.length} {reportNotes.length === 1 ? 'раздел' : reportNotes.length < 5 ? 'раздела' : 'разделов'}</span>
							</header>
							<div class="materials-notes-grid">
								{#each reportNotes as section, i (section.title)}
									<article class="materials-note-card">
										<header><span>{String(i + 1).padStart(2, '0')}</span><h3>{section.title}</h3></header>
										<ul>{#each section.items as item}<li>{item}</li>{/each}</ul>
									</article>
								{/each}
							</div>
						</div>
					{:else if activeMaterialsTab === 'visuals'}
						<div id="materials-panel-visuals" class="materials-panel" role="tabpanel" aria-labelledby="materials-tab-visuals">
							<header class="materials-panel-head">
								<span class="materials-panel-kicker"><ImageSquare size={16} aria-hidden="true" /> Визуальные памятки</span>
								<span>{reportVisualCount} {reportVisualCount === 1 ? 'материал' : 'материала'}</span>
							</header>
							<div class="materials-visuals">
								{#if reportInfographic}
									<figure class="materials-visual">
										{#if reportVisualCount > 1}<figcaption>Инфографика</figcaption>{/if}
										<a href={`${base}/${reportInfographic.src}`} target="_blank" rel="noreferrer" aria-label="Открыть инфографику в полном размере">
											<img src={`${base}/${reportInfographic.src}`} alt={reportInfographic.alt} loading="lazy" decoding="async" />
										</a>
									</figure>
								{/if}
								{#if reportExerciseMemo}
									<figure class="materials-visual">
										{#if reportVisualCount > 1}<figcaption>Памятка по упражнениям</figcaption>{/if}
										<a href={`${base}/${reportExerciseMemo.src}`} target="_blank" rel="noreferrer" aria-label="Открыть памятку по упражнениям в полном размере">
											<img src={`${base}/${reportExerciseMemo.src}`} alt={reportExerciseMemo.alt} loading="lazy" decoding="async" />
										</a>
									</figure>
								{/if}
							</div>
						</div>
					{:else if activeMaterialsTab === 'glossary'}
						<div id="materials-panel-glossary" class="materials-panel" role="tabpanel" aria-labelledby="materials-tab-glossary">
							<header class="materials-panel-head">
								<span class="materials-panel-kicker"><Cards size={16} aria-hidden="true" /> Термины и определения</span>
								<span>{reportGlossary.length} терминов</span>
							</header>
							<dl class="materials-glossary-grid">
								{#each reportGlossary as item (item.term)}
									<div><dt>{item.term}</dt><dd>{item.definition}</dd></div>
								{/each}
							</dl>
						</div>
					{:else if hasTranscript}
						<div id="materials-panel-transcript" class="materials-panel" role="tabpanel" aria-labelledby="materials-tab-transcript">
							<header class="materials-panel-head">
								<span class="materials-panel-kicker"><TextAlignLeft size={16} aria-hidden="true" /> Полный текст лекции</span>
								{@render fontControls()}
								<button
									type="button"
									class:copied={transcriptCopyState === 'copied'}
									class="copy-transcript"
									aria-label={transcriptCopyState === 'copied' ? 'Расшифровка скопирована' : 'Скопировать полную расшифровку'}
									title={transcriptCopyState === 'copied' ? 'Скопировано' : transcriptCopyState === 'error' ? 'Не удалось скопировать' : 'Скопировать расшифровку'}
									onclick={copyTranscript}
								>
									{#if transcriptCopyState === 'copied'}<Check size={18} weight="bold" />{:else}<CopySimple size={18} />{/if}
								</button>
								<span class="copy-status" role="status" aria-live="polite">
									{transcriptCopyState === 'copied' ? 'Расшифровка скопирована' : transcriptCopyState === 'error' ? 'Не удалось скопировать расшифровку' : ''}
								</span>
							</header>
							<div class="materials-transcript" style="--transcript-scale: {transcriptScale}">
								{#if transcriptLoadState === 'ready'}
									<p>{transcriptText}</p>
								{:else if transcriptLoadState === 'error'}
									<p class="transcript-status">Не удалось загрузить расшифровку. Обновите страницу и попробуйте ещё раз.</p>
								{:else}
									<p class="transcript-status">Загрузка расшифровки…</p>
								{/if}
							</div>
						</div>
					{/if}
				</section>
			{/if}

			{#if hasTranscript && !hasStudyMaterials}
				<section class="transcript reveal extra-block" {@attach reveal()}>
					<details bind:open={transcriptOpen}>
						<summary>
							<span>Полная расшифровка</span>
							<span class="transcript-actions">
								<button
									type="button"
									class:copied={transcriptCopyState === 'copied'}
									class="copy-transcript"
									aria-label={transcriptCopyState === 'copied' ? 'Расшифровка скопирована' : 'Скопировать полную расшифровку'}
									title={transcriptCopyState === 'copied' ? 'Скопировано' : transcriptCopyState === 'error' ? 'Не удалось скопировать' : 'Скопировать расшифровку'}
									onclick={copyTranscript}
								>
									{#if transcriptCopyState === 'copied'}<Check size={18} weight="bold" />{:else}<CopySimple size={18} />{/if}
								</button>
								<CaretDown class="transcript-caret" size={17} />
							</span>
							<span class="copy-status" role="status" aria-live="polite">
								{transcriptCopyState === 'copied' ? 'Расшифровка скопирована' : transcriptCopyState === 'error' ? 'Не удалось скопировать расшифровку' : ''}
							</span>
						</summary>
						{#if transcriptOpen}
							<div class="transcript-toolbar">{@render fontControls()}</div>
							<div class="transcript-body" style="--transcript-scale: {transcriptScale}">
								{#if transcriptLoadState === 'ready'}
									<p>{transcriptText}</p>
								{:else if transcriptLoadState === 'error'}
									<p class="transcript-status">Не удалось загрузить расшифровку. Обновите страницу и попробуйте ещё раз.</p>
								{:else}
									<p class="transcript-status">Загрузка расшифровки…</p>
								{/if}
							</div>
						{/if}
					</details>
				</section>
			{/if}
						</div>
					</details>
				</section>
			{/if}
			</div>

			<section class="chapters" aria-labelledby="chapters-title">
				<div class="section-heading section-heading--plain"><h2 id="chapters-title">Смысловые блоки</h2></div>
				{#each report.chapters as chapter, i (chapter.start)}
					<div class="reveal" {@attach reveal()}>
						<ChapterCard {chapter} index={i} onSeek={report.video ? seekVideo : undefined} playing={playingIndex === i} live={videoPlaying && playingIndex === i} highlight={highlightQuery} />
					</div>
				{/each}
			</section>

			<p class="source label">{report.source_name}</p>
		</div>
	</div>
</article>
{/if}

<style>
	.report {
		padding-top: clamp(24px, 4vw, 52px);
		padding-bottom: 64px;
		max-width: 1320px;
	}

	.report-head { padding-bottom: 14px; }
	.breadcrumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; color: var(--ink-faint); font-size: 14px; }
	.breadcrumbs a { color: var(--accent); }
	.eyebrow { margin: 0 0 8px; color: var(--accent); }

	.layout {
		display: grid;
		grid-template-columns: minmax(300px, 36%) minmax(0, 1fr);
		gap: clamp(32px, 4vw, 56px);
		align-items: start;
		margin-top: 38px;
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
		font-size: clamp(38px, 5vw, 66px);
		font-weight: 500;
		margin: 0 0 14px;
		max-width: 18ch;
		line-height: 1;
	}

	.subtitle {
		font-size: clamp(18px, 1.8vw, 22px);
		color: var(--ink-soft);
		max-width: 64ch;
		margin: 0;
		line-height: 1.55;
	}

	.report-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 24px; margin-top: 22px; color: var(--ink-soft); font-size: 14px; }
	.report-meta > span { display: inline-flex; align-items: center; gap: 7px; }
	.report-meta .views { color: var(--ink-faint); }
	.memberships { margin: 14px 0 0; color: var(--ink-faint); }
	.memberships a { color: var(--accent); text-transform: none; letter-spacing: 0; }

	.overview { max-width: 920px; padding: 0 0 4px; }
	.top-sections {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: clamp(34px, 4vw, 48px);
		align-items: start;
		margin-top: 40px;
	}
	.top-sections > .overview,
	.top-sections > .additional { min-width: 0; max-width: 920px; }
	.top-sections .section-heading h2 { font-size: clamp(27px, 2.8vw, 36px); }
	.section-heading { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 12px; align-items: baseline; }
	.section-heading--plain { grid-template-columns: minmax(0, 1fr); }
	.section-heading h2 { margin: 0; font-size: clamp(28px, 3vw, 39px); font-weight: 500; line-height: 1.1; }
	.overview > ul, .more-theses ul { display: grid; gap: 10px; margin: 20px 0 0 54px; padding: 0; list-style: none; }
	.overview li { position: relative; padding-left: 20px; font-size: 17px; line-height: 1.55; }
	.overview li::before { content: ''; position: absolute; left: 1px; top: 0.72em; width: 9px; height: 1px; background: var(--accent); }

	/* Копирование тезиса: кнопка проявляется на hover/фокусе, на тач-экранах видна всегда */
	.copy-quote {
		display: inline-grid;
		place-items: center;
		width: 26px;
		height: 26px;
		margin-left: 8px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--ink-faint);
		vertical-align: middle;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
	}

	.overview li:hover .copy-quote,
	.copy-quote:focus-visible,
	.copy-quote.copied {
		opacity: 1;
	}

	.copy-quote:hover { color: var(--accent); background: var(--paper-2); }
	.copy-quote.copied { color: var(--accent); }

	@media (hover: none) {
		.copy-quote { opacity: 0.55; }
	}
	.more-theses { margin: 14px 0 0 54px; }
	.more-theses summary { display: inline-flex; align-items: center; gap: 7px; color: var(--accent); cursor: pointer; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; list-style: none; }
	.more-theses summary::-webkit-details-marker { display: none; }
	.more-theses summary :global(svg) { transition: transform 0.2s ease; }
	.more-theses[open] summary :global(svg) { transform: rotate(180deg); }
	.more-theses ul { margin-left: 0; }

	.study-materials {
		margin-top: 14px;
		border: 1px solid var(--line-strong);
		border-radius: 12px;
		overflow: hidden;
		background: color-mix(in srgb, var(--paper-2) 48%, var(--paper));
		box-shadow: 0 16px 36px color-mix(in srgb, var(--ink) 5%, transparent);
	}

	.materials-tablist {
		display: flex;
		gap: 4px;
		padding: 6px;
		border-bottom: 1px solid var(--line);
		background: color-mix(in srgb, var(--paper-2) 74%, transparent);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.materials-tablist::-webkit-scrollbar { display: none; }

	.materials-tablist button {
		flex: 0 0 auto;
		min-height: 38px;
		padding: 8px 12px;
		border: 1px solid transparent;
		border-radius: 7px;
		background: transparent;
		color: var(--ink-faint);
		font: inherit;
		font-size: 13px;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		cursor: pointer;
		transition:
			background-color 0.18s ease,
			border-color 0.18s ease,
			color 0.18s ease;
	}

	.materials-tablist button:hover {
		color: var(--ink);
		background: color-mix(in srgb, var(--paper) 72%, transparent);
	}

	.materials-tablist button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.materials-tablist button.active {
		border-color: color-mix(in srgb, var(--accent) 28%, var(--line));
		background: var(--paper);
		color: var(--accent);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--ink) 6%, transparent);
	}

	.materials-tablist button :global(svg) { flex: 0 0 auto; }

	.materials-tab-count {
		min-width: 20px;
		padding: 1px 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink-faint) 10%, transparent);
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1.5;
		text-align: center;
	}

	.materials-tablist button.active .materials-tab-count {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.materials-panel {
		min-width: 0;
	}

	.materials-panel-head {
		min-height: 56px;
		padding: 16px 18px;
		border-bottom: 1px solid var(--line);
		display: flex;
		align-items: center;
		gap: 16px;
		color: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.materials-panel-kicker {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-right: auto;
		color: var(--ink);
		font-weight: 600;
	}

	.materials-panel-kicker :global(svg) { color: var(--accent); }

	.materials-visuals {
		display: grid;
		gap: 1px;
		background: var(--line);
	}

	.materials-visual {
		min-width: 0;
		margin: 0;
		padding: 18px;
		background: var(--paper);
	}

	.materials-visual figcaption {
		margin-bottom: 12px;
		color: var(--ink);
		font-size: 15px;
		font-weight: 600;
	}

	.materials-visual a {
		display: block;
		border-radius: 8px;
	}

	.materials-visual a:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}

	.materials-visual img {
		display: block;
		width: 100%;
		height: auto;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: #fff;
	}

	.materials-notes-grid,
	.materials-glossary-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1px;
		margin: 0;
		padding: 0;
		background: var(--line);
	}

	.materials-note-card,
	.materials-glossary-grid > div {
		min-width: 0;
		padding: 20px;
		background: var(--paper);
	}

	.materials-note-card header {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: 10px;
		margin-bottom: 12px;
	}

	.materials-note-card header > span {
		padding-top: 3px;
		color: var(--accent);
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
	}

	.materials-note-card h3 {
		margin: 0;
		color: var(--ink);
		font-size: 17px;
		font-weight: 600;
		line-height: 1.25;
	}

	.materials-note-card ul {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
		color: var(--ink-soft);
		font-size: 14px;
		line-height: 1.58;
	}

	.materials-note-card li {
		position: relative;
		padding-left: 13px;
		overflow-wrap: anywhere;
	}

	.materials-note-card li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.72em;
		width: 5px;
		height: 1px;
		background: var(--accent);
	}

	.materials-glossary-grid dt {
		margin: 0 0 7px;
		color: var(--ink);
		font-size: 16px;
		font-weight: 600;
		line-height: 1.3;
	}

	.materials-glossary-grid dd {
		margin: 0;
		color: var(--ink-soft);
		font-size: 14px;
		line-height: 1.58;
		overflow-wrap: anywhere;
	}

	.materials-panel-head .copy-transcript {
		margin-left: auto;
		flex: 0 0 auto;
	}

	.materials-transcript {
		max-height: min(62vh, 560px);
		overflow: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: var(--line-strong) transparent;
	}

	.materials-transcript p {
		margin: 0;
		padding: 22px;
		color: var(--ink-soft);
		font-size: calc(15px * var(--transcript-scale, 1));
		line-height: 1.75;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.transcript-status {
		color: var(--ink-muted, var(--ink-soft));
		font-style: italic;
	}

	.seminar-exercises {
		border: 0;
	}

	.seminar-exercises summary {
		cursor: pointer;
		min-height: 50px;
		margin: 0 -12px;
		padding: 13px 12px;
		border-radius: 8px;
		list-style: none;
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 17px;
		transition:
			background-color 0.18s ease,
			color 0.18s ease;
	}

	.seminar-exercises summary:hover,
	.transcript summary:hover,
	.seminar-exercises[open] summary,
	.transcript details[open] summary {
		background: color-mix(in srgb, var(--paper-2) 58%, transparent);
	}

	.seminar-exercises summary > :global(svg),
	.transcript summary > :global(svg) { margin-left: auto; color: var(--accent); transition: transform 0.2s ease; }
	.seminar-exercises[open] summary > :global(svg),
	.transcript details[open] summary > :global(svg) { transform: rotate(180deg); }

	.seminar-exercises summary::-webkit-details-marker {
		display: none;
	}

	.chapters { margin-top: 56px; }

	.chapters > .section-heading { margin-bottom: 10px; }
	.chapters > .section-heading + .reveal :global(.chapter) { border-top: 0; }
	.additional { margin-top: 0; }
	.additional-disclosure { border: 0; }
	.additional-summary {
		min-height: 58px;
		padding: 8px 0 12px;
		list-style: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		cursor: pointer;
	}
	.additional-summary::-webkit-details-marker { display: none; }
	.additional-summary:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 5px;
		border-radius: 4px;
	}
	.additional-title {
		font-size: clamp(27px, 2.8vw, 36px);
		font-weight: 500;
		line-height: 1.1;
	}
	.additional-summary-action {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--accent);
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.additional-summary-action :global(svg) { transition: transform 0.2s ease; }
	.additional-disclosure[open] .additional-summary-action :global(svg) { transform: rotate(180deg); }
	.additional-content { padding-top: 2px; }
	.extra-block { margin-top: 0; }
	.extra-block + .extra-block { margin-top: 2px; }
	.extra-title { margin: 0 0 14px; font-size: 20px; font-weight: 500; }

	.focus-section {
		margin-top: 0;
		border-top: 1px solid var(--line-strong);
		border-bottom: 1px solid var(--line);
		padding: 18px 0 24px;
	}

	.focus-tablist {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 18px;
	}

	.focus-tablist button {
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		padding: 6px 14px;
		background: transparent;
		color: var(--ink-soft);
		font: inherit;
		font-size: 13px;
		cursor: pointer;
		transition:
			color 0.2s ease,
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.focus-tablist button:hover,
	.focus-tablist button.active {
		color: var(--paper);
		background: var(--accent);
		border-color: var(--accent);
	}

	.focus-panel {
		max-width: var(--measure);
	}

	.focus-intro {
		display: grid;
		gap: 8px;
		margin-bottom: 18px;
		color: var(--ink-soft);
		font-size: 16px;
		line-height: 1.6;
	}

	.focus-intro p {
		margin: 0;
	}

	.focus-items {
		display: grid;
		gap: 18px;
	}

	.focus-item {
		padding-top: 18px;
		border-top: 1px solid var(--line);
	}

	.focus-item header {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: baseline;
		gap: 10px;
		margin-bottom: 8px;
	}

	.focus-item h2 {
		margin: 0;
		color: var(--ink);
		font-size: 20px;
		line-height: 1.25;
	}

	.focus-item p {
		margin: 0 0 10px;
		color: var(--ink-soft);
		font-size: 16px;
		line-height: 1.6;
	}

	.focus-item ul {
		display: grid;
		gap: 6px;
		margin: 0;
		padding-left: 20px;
		color: var(--ink-soft);
		font-size: 15px;
		line-height: 1.55;
	}

	.focus-item li::marker {
		color: var(--accent);
	}

	.focus-time {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		width: max-content;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		padding: 3px 9px;
		color: var(--ink-soft);
		background: transparent;
		font-size: 11px;
		line-height: 1.35;
		cursor: pointer;
		transition:
			color 0.2s ease,
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.focus-time:hover {
		color: var(--paper);
		background: var(--accent);
		border-color: var(--accent);
	}

	.focus-time :global(svg) {
		color: var(--accent);
		transition: color 0.2s ease;
	}

	.focus-time:hover :global(svg) {
		color: var(--paper);
	}

	.focus-time-static {
		cursor: default;
	}

	.seminar-exercises-section {
		margin-top: 0;
	}

	.seminar-exercises {
		border-top: 0;
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

	.exercise-time :global(svg) {
		color: var(--accent);
		transition: color 0.2s ease;
	}

	.exercise-time:hover :global(svg) {
		color: var(--paper);
	}

	.transcript {
		margin-top: 0;
	}

	.transcript details {
		border-top: 0;
	}

	.transcript summary {
		cursor: pointer;
		min-height: 50px;
		margin: 0 -12px;
		padding: 13px 12px;
		border-radius: 8px;
		list-style: none;
		display: flex;
		align-items: center;
		font-size: 17px;
		transition:
			background-color 0.18s ease,
			color 0.18s ease;
	}

	.transcript summary::-webkit-details-marker {
		display: none;
	}

	.transcript-actions {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 9px;
	}

	.copy-transcript {
		width: 34px;
		height: 34px;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
		border-radius: 8px;
		color: var(--accent);
		background: color-mix(in srgb, var(--paper) 78%, transparent);
		display: inline-grid;
		place-items: center;
		cursor: pointer;
		transition:
			color 0.18s ease,
			background-color 0.18s ease,
			border-color 0.18s ease,
			transform 0.18s ease;
	}

	.copy-transcript:hover {
		color: var(--paper);
		background: var(--accent);
		border-color: var(--accent);
	}

	.copy-transcript:active {
		transform: scale(0.94);
	}

	.copy-transcript.copied {
		color: var(--paper);
		background: var(--accent);
		border-color: var(--accent);
	}

	.transcript-actions :global(.transcript-caret) {
		color: var(--accent);
		transition: transform 0.2s ease;
	}

	.transcript details[open] :global(.transcript-caret) {
		transform: rotate(180deg);
	}

	.copy-status {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.transcript p {
		margin: 0 0 24px;
		color: var(--ink-soft);
		font-size: calc(17px * var(--transcript-scale, 1));
		line-height: 1.85;
		max-width: var(--measure);
	}

	.transcript-toolbar {
		display: flex;
		justify-content: flex-end;
		margin: 14px 0 6px;
	}

	.font-controls {
		display: inline-flex;
		gap: 4px;
	}

	.font-controls button {
		display: inline-grid;
		place-items: center;
		min-width: 34px;
		height: 28px;
		padding: 0 7px;
		border: 1px solid var(--line-strong);
		border-radius: 6px;
		background: transparent;
		color: var(--ink-soft);
		font-family: var(--font-mono);
		font-size: 12px;
		cursor: pointer;
		transition: color 0.2s ease, border-color 0.2s ease;
	}

	.font-controls button:hover:not(:disabled) {
		color: var(--accent);
		border-color: var(--accent);
	}

	.font-controls button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.source {
		margin: 32px 0 0;
		color: var(--ink-faint);
		word-break: break-all;
	}

	@media (max-width: 960px) {
		.top-sections { grid-template-columns: minmax(0, 1fr); }
		.report { padding-top: 22px; }
		.report-head { padding-bottom: 24px; }
		.layout { margin-top: 28px; }
		.chapters { margin-top: 32px; }
		.layout,
		.layout.no-video {
			grid-template-columns: 1fr;
			gap: 24px;
		}

		.rail {
			display: contents;
			max-height: none;
		}

		.nav-scroll {
			overflow: visible;
			max-height: none;
		}

		.video-pin {
			position: static;
			background: var(--paper);
			padding-bottom: 4px;
		}

		.video-pin.playback-started {
			position: sticky;
			top: 8px;
			z-index: 5;
			box-shadow: 0 10px 0 var(--paper);
		}

		.chapters :global(.chapter),
		#overview-title,
		#additional-title {
			scroll-margin-top: calc(var(--mobile-sticky-h, 0px) + 16px);
		}

		.video-hint {
			display: none;
		}

		.report-head h1 {
			max-width: none;
		}

		.seminar-exercises-body {
			grid-template-columns: 1fr;
			gap: 16px;
		}
	}

	@media (max-width: 560px) {
		.report-meta { display: grid; gap: 9px; }
		.additional-summary { gap: 12px; }
		.additional-summary-action > span { display: none; }
		.section-heading { grid-template-columns: 30px minmax(0, 1fr); gap: 8px; }
		.overview > ul, .more-theses ul { margin-left: 38px; }
		.more-theses { margin-left: 38px; }
		.focus-item header { grid-template-columns: 1fr; }
		.materials-tablist { gap: 2px; padding: 4px; }
		.materials-tablist button { padding: 7px 8px; gap: 5px; font-size: 12px; }
		.materials-tablist button :global(svg) { display: none; }
		.materials-panel-head { align-items: flex-start; padding: 14px; }
		.materials-notes-grid,
		.materials-glossary-grid { grid-template-columns: 1fr; }
		.materials-note-card,
		.materials-glossary-grid > div { padding: 17px 15px; }
		.materials-visual { padding: 14px; }
		.materials-transcript p { padding: 18px 15px; }
	}
</style>

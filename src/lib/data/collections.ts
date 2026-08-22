import type { ReportSummary } from '$lib/types';
import { getReportSummary } from './report-meta';

/** Разбор коллекции: что заявлялось и как это сработало на практике. */
export interface CollectionAnalysis {
	/** Вводный абзац-подводка к разбору. */
	lede: string;
	/** Пары «что заявляли на презентации» → «как вышло в боях». */
	findings: { claim: string; reality: string }[];
	/** Итог по результатам и статистике. */
	outcome: string;
}

/** Фасеты каталога. Они задаются явно, чтобы фильтры не зависели от шумных тегов отчётов. */
export interface CollectionFacets {
	authors?: string[];
	places?: string[];
	weapons?: string[];
}

/** Тематическая подборка видео. Видео может входить в несколько коллекций. */
export interface Collection {
	slug: string;
	title: string;
	/** HEMA-коллекции образуют основной каталог; остальные остаются в архиве вторым слоем. */
	hema?: boolean;
	/** Автор, место и оружие для фильтров главной страницы. */
	facets?: CollectionFacets;
	/** Короткая строка для карточки на главной и meta description. */
	subtitle: string;
	/** Развёрнутое описание на странице коллекции (опционально). */
	description?: string;
	/** Содержательный разбор коллекции (опционально). */
	analysis?: CollectionAnalysis;
	/** Slug'и отчётов в порядке показа внутри коллекции. */
	items: string[];
	/** Необязательные визуальные разделы для страницы коллекции. */
	sections?: { title: string; subtitle?: string; items: string[] }[];
	/** Не выводить из коллекции и её отчётов навигацию или поиск по общему архиву. */
	isolated?: boolean;
	/**
	 * Пароль-«ключ». Если задан — и коллекция, и её отчёты закрыты до ввода пароля.
	 * Внимание: это «лёгкий замок» на клиенте, а не настоящая защита: контент всё
	 * равно лежит в JS-бандле. Достаточно, чтобы отсечь случайных людей.
	 */
	password?: string;
	/** Подсказка под полем пароля: как его получить. */
	passwordHint?: string;
}

// Порядок здесь = порядок карточек на главной.
export const collections: Collection[] = [
	{
		slug: 'ii-i-hema',
		title: 'ИИ и HEMA',
		hema: true,
		facets: { authors: ['Пётр Васильев', 'Александр Овчинников'] },
		subtitle: 'ИИ-инструменты, данные и проверяемые гипотезы для анализа боёв и тренировочного процесса.',
		description:
			'Разговоры и разборы о том, как применять языковые модели и спортивную аналитику в HEMA, не подменяя данными тренерскую модель и проверку гипотез.',
		items: ['ii-dlya-analiza-hema-boev']
	},
	{
		slug: 'hema-english',
		title: 'HEMA: English',
		hema: true,
		subtitle: 'Английская терминология частей тела, экипировки и команд на площадке.',
		items: ['hema-english-snaryazhenie']
	},
	{
		slug: 'silovaya-konditsionnaya',
		title: 'Силовая и кондиционная подготовка',
		hema: true,
		facets: { authors: ['Tokarev Coach', 'Jacob Goodin'] },
		subtitle:
			'Научные основы, силовой и аэробный тренинг, адаптации, специальные популяции и спортивная психология.',
		items: [
			'tokarev-silovaya-ofp-2',
			'pliometrika-hema',
			'silovaya-konditsiya-hema',
			'silovaya-plan-hema',
			'printsipy-silovoy-konditsionnoy-podgotovki',
			'struktura-i-funktsiya-myshtsy',
			'neyromyshechnaya-sistema-motornye-edinitsy',
			'sem-dvigatelnyh-patternov',
			'biomehanika-i-myshechnye-rychagi',
			'sila-moshchnost-i-rabota-v-biomehanike',
			'tri-rezhima-myshechnogo-deystviya',
			'faktory-myshechnoy-sily-i-moshchnosti',
			'bioenergetika-trenirovki-tri-energosistemy',
			'laktatnyi-porog-bioenergetika',
			'metabolicheskaya-spetsifichnost-trenirovki',
			'istoschenie-i-vosstanovlenie-substratov',
			'gormon-myshechnye-vzaimodeystviya',
			'osnovnye-anabolicheskie-gormony',
			'neyronnye-adaptatsii-k-anaerobnoy-trenirovke',
			'myshechnye-adaptatsii-anaerobnaya-trenirovka',
			'kosti-suhozhiliya-gormony-serdtse-anaerobnaya-trenirovka',
			'ostrye-reaktsii-aerobnaya-nagruzka',
			'dolgovremennye-adaptatsii-aerobnaya-trenirovka',
			'vysota-krovyanoi-doping-peretrenirovannost',
			'deti-ne-malenkie-vzroslye',
			'trenirovka-muzhchin-i-zhenshchin',
			'silovaya-trenirovka-pozhilyh',
			'silovaya-trenirovka-detey',
			'vozbuzhdenie-trevoga-stress-v-sporte',
			'motivatsiya-vnimanie-fokus-v-sporte',
			'ukreplenie-stopy-i-golenostopa'
		]
	},
	{
		slug: 'almaty-2026',
		title: 'Фехтовальный лагерь «Алматы 2026»',
		hema: true,
		facets: { places: ['Алматы'], weapons: ['Сабля', 'Длинный меч', 'Рапира'] },
		subtitle: 'Семинары и тренировки лагеря: сабля (общая и «А») и длинный меч.',
		items: [
			'sablya-vvodnaya',
			'sablya-a-2',
			'sablya-a-3',
			'sablya-4',
			'sablya-a-5',
			'sablya-6',
			'sablya-a-7',
			'sablya-8',
			'sablya-a-9',
			'sablya-10',
			'sablya-12',
			'longsword-a',
			'rapira-almaty-2026'
		]
	},
	{
		slug: 'lager-vladivostok',
		title: 'Лагерь Владивосток',
		hema: true,
		facets: {
			authors: ['Пётр Васильев'],
			places: ['Владивосток'],
			weapons: ['Длинный меч']
		},
		subtitle: 'Семинары и тренировки лагеря во Владивостоке.',
		items: [
			'gruppa-a-1-vvodnaya',
			'vid-20260708-200742',
			'pozitsionno-oboronitelnyi-tip-osnovnaya-chast',
			'manevrovo-atakuyushchiy-stil',
			'manevrovo-atakuyushchiy-stil-4-2',
			'manevrovo-oboronitelnyi-tip',
			'ataka-prosche-ne-byvaet-udar',
			'gruppa-b-2-ataki-fendenti-na-vypade',
			'gruppa-b-3-vybor-zony-i-distantsii-v-atake',
			'gruppa-b-4-ataki-na-fone-manevrirovaniya',
			'gruppa-b-5-kakari-keiko',
			'obuchenie-trenerov-poisk-znaniy',
			'trenerstvo-2-zadachi-uprazhneniya',
			'trenerskiy-kurs-3-planirovanie-zanyatiy',
			'trenerskiy-kurs-4-tekhnika-bezopasnosti',
			'ukol-po-centralnoy-linii',
			'sudya-gayd-dlya-nachinayushchikh'
		],
		sections: [
			{
				title: 'Группа А',
				subtitle: 'Вводные и позиционные тренировки продвинутой группы.',
				items: [
					'gruppa-a-1-vvodnaya',
					'vid-20260708-200742',
					'pozitsionno-oboronitelnyi-tip-osnovnaya-chast',
					'manevrovo-atakuyushchiy-stil',
					'manevrovo-atakuyushchiy-stil-4-2',
					'manevrovo-oboronitelnyi-tip'
				]
			},
			{
				title: 'Группа Б',
				subtitle: 'Базовая техника атаки и механика удара.',
				items: [
					'ataka-prosche-ne-byvaet-udar',
					'gruppa-b-2-ataki-fendenti-na-vypade',
					'gruppa-b-3-vybor-zony-i-distantsii-v-atake',
					'gruppa-b-4-ataki-na-fone-manevrirovaniya',
					'gruppa-b-5-kakari-keiko'
				]
			},
			{
				title: 'Тренерский курс',
				subtitle:
					'Развитие тренера, поиск знаний, постановка упражнений, планирование и техника безопасности.',
				items: [
					'obuchenie-trenerov-poisk-znaniy',
					'trenerstvo-2-zadachi-uprazhneniya',
					'trenerskiy-kurs-3-planirovanie-zanyatiy',
					'trenerskiy-kurs-4-tekhnika-bezopasnosti'
				]
			},
			{
				title: 'Семинары',
				subtitle: 'Отдельные практические семинары лагеря.',
				items: ['ukol-po-centralnoy-linii', 'sudya-gayd-dlya-nachinayushchikh']
			}
		]
	},
	{
		slug: 'hema-theory',
		title: 'HEMA: теория и тренерство',
		hema: true,
		subtitle: 'Контекст HEMA, методика защит и удержание атлетов в клубе.',
		items: ['metodichka', 'retention'],
		// Пример закрытой коллекции. Поменяй пароль на свой (или убери строку, чтобы открыть).
		password: 'hema',
		passwordHint: 'Чтобы получить пароль — напиши Васильеву Петру.'
	},
	{
		slug: 'podcasts',
		title: 'Подкасты: ИИ и индустрия',
		subtitle: 'Разговоры про искусственный интеллект, найм и будущее разработки.',
		items: [
			'agents-week-2026-1-1-intro-ai-agents-llm',
			'agents-week-2026-1-2-tools-mcp',
			'agents-week-2026-2-memory-guardrails-lecture',
			'agents-week-2026-2-memory-guardrails-seminar',
			'agents-week-2026-3-workflow-multi-agent-multimodality-lecture',
			'agents-week-2026-3-workflow-multi-agent-multimodality-seminar',
			'agents-week-2026-4-agent-evaluation-lecture',
			'agents-week-2026-4-agent-evaluation-seminar',
			'agents-week-2026-5-1-production-engineering',
			'agents-week-2026-5-2-production-engineering',
			'context-engineering-29min',
			'obsidian-wiki-karpathy',
			'llm-deep-dive-karpathy',
			'software-3-0',
			'podlodka-vector-search',
			'podlodka-slm-468',
			'podlodka-naim-ai-482',
			'berezhnoy-ai',
			'agentic-engineering-ai-workflow-deksden-1',
			'vibe-coding-lovushki-myshleniya'
		],
		sections: [
			{
				title: 'Agents Week 2026',
				subtitle:
					'Последовательный курс: основы агентов, инструменты, память, multi-agent workflow, evaluation и production.',
				items: [
					'agents-week-2026-1-1-intro-ai-agents-llm',
					'agents-week-2026-1-2-tools-mcp',
					'agents-week-2026-2-memory-guardrails-lecture',
					'agents-week-2026-2-memory-guardrails-seminar',
					'agents-week-2026-3-workflow-multi-agent-multimodality-lecture',
					'agents-week-2026-3-workflow-multi-agent-multimodality-seminar',
					'agents-week-2026-4-agent-evaluation-lecture',
					'agents-week-2026-4-agent-evaluation-seminar',
					'agents-week-2026-5-1-production-engineering',
					'agents-week-2026-5-2-production-engineering'
				]
			},
			{
				title: 'Фундамент и новые подходы к разработке',
				subtitle: 'Context engineering, базы знаний, устройство LLM и Software 3.0.',
				items: [
					'context-engineering-29min',
					'obsidian-wiki-karpathy',
					'llm-deep-dive-karpathy',
					'software-3-0'
				]
			},
			{
				title: 'Подлодка: AI в продуктах и командах',
				subtitle: 'Поиск, компактные модели и изменения в найме.',
				items: ['podlodka-vector-search', 'podlodka-slm-468', 'podlodka-naim-ai-482']
			},
			{
				title: 'Практические кейсы и образование',
				subtitle: 'Как ИИ меняет рабочий процесс, обучение и инженерную практику.',
				items: [
					'berezhnoy-ai',
					'agentic-engineering-ai-workflow-deksden-1',
					'vibe-coding-lovushki-myshleniya'
				]
			}
		]
	},
	{
		slug: 'nri',
		title: 'НРИ',
		subtitle: 'Настольные ролевые игры: стримы, кампании и разборы сессий.',
		items: ['woodcreek-ch1', 'poisk-novogo-ruchya', 'nri-staraya-shahta']
	},
	{
		slug: 'kendzyu',
		title: 'Кендзюцу',
		hema: true,
		facets: { places: ['Алматы'], weapons: ['Катана'] },
		subtitle: 'Эксперимент новых правил: разбор системы и пробные спарринги на катанах.',
		description:
			'20 июня 2026 — пробный день новой системы баллов для фехтования на катанах. Сначала разбор правил (~13 мин): один балл в раунде, «стоп» на фиксации, порез ценнее удара, кумуляция без авторблоу, формат «4 победы из 7». Затем — десять спаррингов с судейством: шесть атлетов, спорные порезы и дубли, апелляции и правки формулировок прямо по ходу боя. Цель эксперимента — не турнир, а проверить, какую картину боя дают правила: дистанция → клинч → давящий порез, без травм и без «раз-два» в руки.',
		analysis: {
			lede: 'Коллекция устроена как один эксперимент: сначала на презентации проговаривают, как должна работать новая система баллов, а потом десять боёв проверяют каждое правило на прочность. Ниже — что заявляли в теории и что из этого реально получилось на катанах.',
			findings: [
				{
					claim:
						'Порез — главная фишка системы: он ценнее удара и засчитывается уже на фиксации лезвия, а не на рассечении.',
					reality:
						'На практике порез оказался самым спорным элементом почти каждого боя: спорили, шло давление в клинок или в тело, лезвием или плоскостью, а порез в голову сбоку судьи попросту не видят. По ходу пришлось донастраивать язык — «удар с порезом» переименовали в обычный «удар», появился термин «недорез», обсудили ограничение зон пореза шеей, подмышками и корпусом. Эталонные реализации были эффектны («подождал и зафиксировал»), но судейство пореза — главная зона доработки.'
				},
				{
					claim:
						'Безопасность важнее зрелища: фиксируем, а не рубим, после «стопа» не бьём — пострадать не должен никто.',
					reality:
						'Идея частично сработала — дошло до того, что «бить даже не надо: наложил клинок и выиграл раунд». Но один бой остановили из‑за оглушения: боец по привычке с лонга и сабли ушёл «разворотом» и поймал удар в голову сбоку, а следующий бой и вовсе отменили. Вывод тренеров: в клинче на катанах нужно давить вперёд, а не уходить, и пока бойцы не переучатся, риск сохраняется.'
				},
				{
					claim: '«Стоп» подаётся ровно в момент набора балла или фиксации пореза.',
					reality:
						'Тайминг «стопа» оказался слабым местом самих судей: то опаздывали («дал стоп позже, чем надо»), то останавливали преждевременно — и это меняло квалификацию (укол засчитывали вместо фазы контроля). Записали как навык, который судейской бригаде ещё предстоит наработать.'
				},
				{
					claim:
						'Никаких авторблоу — только дубли: при размене баллы обоим, решает сумма, а кумулятивный эффект (рука + рука < головы) определяет раунд.',
					reality:
						'Самая беспроблемная часть системы. Кумулятивный набор и дубли работали предсказуемо, а споры касались только факта (был ли дубль, в какую зону), но не самой механики. Обоюдный дубль равными зонами честно давал ничью в раунде — ровно как задумано.'
				},
				{
					claim:
						'Желаемая картина боя: дистанция → клинч → давящий порез, без бессмысленного «раз‑два» в руки.',
					reality:
						'В учебных и контролируемых эпизодах картинка действительно складывалась, а атаки флетом катаны сами собой оказались невыгодны — как и рассчитывали. Но в равных боях чаще решали уколы, удары в руку и кумулятивный набор, а не «киношные» порезы: пока порез — скорее премиальный приём, чем основа боя.'
				},
				{
					claim: 'На вход подаётся готовая система баллов, которую сегодня просто обкатывают.',
					reality:
						'По факту правила правили прямо по ходу: терминология, жесты зон (кулак / поднятая ладонь — старшая зона), ограничение зон пореза, признание конфликта интересов (боец судит сам себя — балл не дают, «на турнире бы не прошло»). Много апелляций и опоры на бокового судью и секунданта — это была живая калибровка, а не финальный регламент.'
				}
			],
			outcome:
				'Итог дня — 10 спаррингов с судейством, 6 бойцов, около часа записи. Победы поделили Олег и Али (по 3), Андрей и Тимирбат (по 2). Система даёт упорные матчи: четыре боя из десяти решились только в последнем раунде со счётом 4:3. При этом один бой остановили из‑за оглушения, а ещё один отменили из соображений безопасности — то есть направление «безопасно и зрелищно» правила задают верно, но и честно подсветили, что дорабатывать нужно судейство пореза и отучать бойцов от лонговых привычек.'
		},
		items: [
			'kendzyu-pravila-1',
			'2026-06-20-18-43-53',
			'2026-06-20-18-39-45',
			'kendzyu-sparring-ali-andrey',
			'2026-06-20-185936',
			'kendzyu-sparring-oleg-golub',
			'kendzyu-sparring-ali-vov',
			'almaty-sparring-ali-2026',
			'almaty-sparring-2026-2',
			'kendzyu-sparring-1',
			'kendzyu-sparring-vova-timirbat'
		]
	},
	{
		slug: 'psihologiya',
		title: 'Психология',
		subtitle: 'Курс Nancy McWilliams: психоаналитическая диагностика и организация личности.',
		items: ['mcwilliams-10-aspects', 'psihologiya-tyazhest-klinicheskaya', 'psihologiya-3-isterechnaya', 'psihologiya-4-depressivnaya', 'psihologiya-5-shizoidnaya-paranoidnaya', 'psihologiya-6-narcissicheskaya']
	},
	{
		slug: 'ovchinnikov-lectures',
		title: 'Лекции и семинары Овчинникова Александра',
		hema: true,
		facets: { authors: ['Александр Овчинников'], weapons: ['Длинный меч'] },
		subtitle: 'Теория HEMA, тренерство, тактика и разборы практики фехтования.',
		items: [
			'protivnik-fehtuet-nepravilno',
			'optimizatsiya-parad-ripost-hema',
			'hema-prednamerennye-ekspromtnye',
			'kontseptsiya-monitoringa',
			'obuchenie-situatsiya-subtaktika',
			'subtaktika-teh-realizacii',
			'2026-07-06-19-26-42',
			'kompresiya-taktiki-lektsiya',
			'fehtovat-dolgo-ne-travmirovatsya',
			'retention-club',
			'hema-reflections',
			'tenouti-i-tyakin-sibori',
			'tsena-adaptatsii-tehnicheskogo-priema'
		]
	},
	{
		slug: 'noname',
		title: 'NoName, фехтовальный лагерь 2026',
		hema: true,
		isolated: true,
		facets: {
			authors: ['Турин', 'Евген', 'Пётр Васильев', 'Александр Овчинников'],
			weapons: ['Сабля', 'Длинный меч']
		},
		subtitle:
			'Материалы фехтовального лагеря NoName 2026: лекции Турина, кинезио Евгена, меч Пети и сабля Саши.',
		items: [
			'fizpodgotovka-dlya-fekhtovalshchika-turin',
			'pitanie-i-ves-fekhtovalshchika-turin',
			'kinezio-trenirovka-1-razminka-koordinatsiya',
			'kinezio-trenirovka-2-stopa-golenostop',
			'kinezio-trenirovka-3-tazobedrennyy-sustav',
			'kinezio-trenirovka-4-kisti-paltsy-lokti',
			'kinezio-trenirovka-5-plechevoy-poyas',
			'soedinenie-dlinnyi-mech-lager-noname-1',
			'soedinenie-dlinnyi-mech-lager-noname-2-utro',
			'soedinenie-dlinnyi-mech-lager-noname-3',
			'soedinenie-dlinnyi-mech-lager-noname-4',
			'soedinenie-dlinnyi-mech-lager-noname-poteryannaya',
			'soedinenie-dlinnyi-mech-lager-noname-7',
			'avstriyskaya-sablya-2',
			'avstriyskaya-sablya-trenirovka-3',
			'avstriyskaya-sablya-obratnoe-lezvie',
			'avstriyskaya-sablya-trenirovka-5-povtorenie',
			'avstriyskaya-sablya-trenirovka-6-batmany-vybor'
		],
		sections: [
			{
				title: 'Лекции Турина',
				subtitle: 'Физическая подготовка, питание и управление весом фехтовальщика.',
				items: [
					'fizpodgotovka-dlya-fekhtovalshchika-turin',
					'pitanie-i-ves-fekhtovalshchika-turin'
				]
			},
			{
				title: 'Кинезио Евгена',
				subtitle: 'Тренировки 1–5: общая разминка, стопы, ноги, руки и плечевой пояс.',
				items: [
					'kinezio-trenirovka-1-razminka-koordinatsiya',
					'kinezio-trenirovka-2-stopa-golenostop',
					'kinezio-trenirovka-3-tazobedrennyy-sustav',
					'kinezio-trenirovka-4-kisti-paltsy-lokti',
					'kinezio-trenirovka-5-plechevoy-poyas'
				]
			},
			{
				title: 'Меч Пети',
				subtitle:
					'Шесть последовательных тренировок по соединению: от входа и чувства клинка до сборки всего цикла.',
				items: [
					'soedinenie-dlinnyi-mech-lager-noname-1',
					'soedinenie-dlinnyi-mech-lager-noname-2-utro',
					'soedinenie-dlinnyi-mech-lager-noname-3',
					'soedinenie-dlinnyi-mech-lager-noname-4',
					'soedinenie-dlinnyi-mech-lager-noname-poteryannaya',
					'soedinenie-dlinnyi-mech-lager-noname-7'
				]
			},
			{
				title: 'Сабля Саши',
				subtitle:
					'Практический цикл по австрийской сабле: пять записанных тренировок, с 1 по 5.',
				items: [
					'avstriyskaya-sablya-2',
					'avstriyskaya-sablya-trenirovka-3',
					'avstriyskaya-sablya-obratnoe-lezvie',
					'avstriyskaya-sablya-trenirovka-5-povtorenie',
					'avstriyskaya-sablya-trenirovka-6-batmany-vybor'
				]
			}
		]
	},
	{
		slug: 'sobraniya-core-noname',
		title: 'Собрания Core NoName',
		hema: true,
		isolated: true,
		subtitle: 'Стратегические встречи ядра NoName: цели, метрики, ответственные и ежемесячные планы развития клуба.',
		description:
			'Рабочие собрания Core NoName о развитии клуба: от привлечения и удержания атлетов до тренерских процессов, финансовой устойчивости и АХЧ.',
		items: ['sobranie-core-noname-1'],
		password: 'NoName_2026'
	},
	{
		slug: 'seminary-korotovskih',
		title: 'Семинары Вячеслава Коротовских',
		hema: true,
		facets: {
			authors: ['Вячеслав Коротовских'],
			weapons: ['Сабля', 'Рапира']
		},
		subtitle: 'Практические семинары по тактике сабли и рапиры.',
		items: [
			'podgotovka-ataki-na-sable-korotovskih',
			'rapira-protiv-vstrechnogo-ukola-korotovskih',
			'fehtovanie-s-prioritetom-v-atake-korotovskih'
		]
	},
	{
		slug: 'noname-sparring',
		title: 'NoName: спарринги',
		hema: true,
		facets: { places: ['Алматы'], weapons: ['Длинный меч'] },
		subtitle: 'Учебные спарринги клуба NoName с комментарием по обменам.',
		items: ['fedotikov-mironov']
	},
	{
		slug: 'raznoe',
		title: 'Разное',
		subtitle: 'Подкасты и разговоры вне основных тематических коллекций.',
		items: ['nikitin-muzhchiny-zhenshiny']
	},
	{
		slug: 'golden-falcon-astana',
		title: 'Golden Falcon Astana',
		hema: true,
		facets: {
			authors: ['Александр Овчинников'],
			places: ['Астана'],
			weapons: ['Длинный меч']
		},
		subtitle: 'Тренировки и разборы фехтовального клуба в Астане.',
		items: [
			'optimizatsiya-parad-ripost-hema',
			'hema-prednamerennye-ekspromtnye',
			'fehtovat-dolgo-ne-travmirovatsya',
			'kontseptsiya-monitoringa',
			'kompresiya-taktiki-lektsiya',
			'hema-reflections',
			'protivnik-fehtuet-nepravilno',
			'trenerskoe-sobranie',
			'trenerskoe-sobranie-novyi-zal',
			'trenerskoe-sobranie-novyi-zal-chast-2',
			'trenerskoe-sobranie-novyi-zal-chast-3',
			'trenerskoe-sobranie-novyi-zal-chast-4',
			'trenerskoe-sobranie-dva-zala',
			'dofamin-neyronnye-svyazi-pasha',
			'2026-07-06-19-26-42'
		]
	}
];

export function getCollection(slug: string): Collection | undefined {
	return collections.find((c) => c.slug === slug);
}

export function getCollectionSlugs(): string[] {
	return collections.map((c) => c.slug);
}

/** Отчёты коллекции в заданном порядке (несуществующие slug'и отбрасываются). */
export function collectionReports(collection: Collection): ReportSummary[] {
	return collection.items
		.map((slug) => getReportSummary(slug))
		.filter((r): r is ReportSummary => Boolean(r));
}

/** Коллекции, в которые входит отчёт (для крошек на странице отчёта). */
export function collectionsForReport(slug: string): Collection[] {
	return collections.filter((c) => c.items.includes(slug));
}

/**
 * Коллекции-«замки», закрывающие доступ к отчёту.
 * Отчёт открыт (пустой массив), если он не входит ни в одну коллекцию или хотя бы
 * одна из его коллекций без пароля. Иначе — список всех коллекций под паролем
 * (подойдёт пароль от любой из них).
 */
export function reportGate(slug: string): Collection[] {
	const containing = collectionsForReport(slug);
	if (containing.length === 0) return [];
	if (containing.some((c) => !c.password)) return [];
	return containing;
}

export interface CollectionStats {
	videos: number;
	chapters: number;
	duration: number;
}

export function collectionStats(collection: Collection): CollectionStats {
	const rs = collectionReports(collection);
	return {
		videos: rs.length,
		chapters: rs.reduce((acc, r) => acc + r.chapterCount, 0),
		duration: rs.reduce((acc, r) => acc + r.duration, 0)
	};
}

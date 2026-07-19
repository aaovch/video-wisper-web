/**
 * Вкладывает сегменты транскрипта Whisper в chapters[].segments по тайм-кодам блоков.
 * Запуск из корня video-wisper-web: node scripts/inject-transcripts.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pipelineRoot = join(root, '..');

const SOURCES = [
	{
		reportPath: join(root, 'src/lib/data/reports/retention.json'),
		transcriptPath: join(pipelineRoot, 'output/2026-06-13 14-57-04/transcript.json')
	},
	{
		reportPath: join(root, 'src/lib/data/reports/metodichka.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Методичка к семинару _Вакцина от ударов по рукам_/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/berezhnoy-ai.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Искусственный интеллект, найм и образование ｜ Сергей Бережной, CTO Практикума, директор в Яндексе [V3fahH0XA0M]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/hema-reflections.json'),
		transcriptPath: join(pipelineRoot, 'output/Что такое HEMA？ Размышления [5gfdZi36pgU]/transcript.json')
	},
	{
		reportPath: join(root, 'src/lib/data/reports/software-3-0.json'),
		transcriptPath: join(pipelineRoot, 'output/Software 3.0： код будущего [CDpnhKypevg]/transcript.json')
	},
	{
		reportPath: join(root, 'src/lib/data/reports/longsword-a.json'),
		transcriptPath: join(pipelineRoot, 'output/Longsword A [Mg780unogxM]/transcript.json')
	},
	{
		reportPath: join(root, 'src/lib/data/reports/rapira-almaty-2026.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Рапира, Алматы, 2026 [zich_vIXLys]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sablya-a-3.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Сабля ＂А＂, 3 тренировка [fdJrJHXjhes]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sablya-a-2.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Сабля ＂А＂, 2 тренировка [VG6MqJK4hzc]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sablya-vvodnaya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Сабля, вводная тренировка [mxIREOVizmk]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sablya-4.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Сабля, общая, 4 тренировка [atO8AQMPVtk]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sablya-a-5.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Сабля, ＂А＂, 5 тренировка [xpS4HVZJAgg]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sablya-6.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Сабля, общая, 6 тренировка [YDoVTkB6H3o]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sablya-a-7.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Сабля, ＂А＂, 7 тренировка [ke1M9qAEp4g]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sablya-8.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Сабля, общая, 8 тренировка [HsfYbOiKk1c]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sablya-10.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Сабля, общая, 10 тренировка [JQ2Lt6SC_C4]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sablya-12.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Сабля, общая, 12 тренировка [GDcReeyyOp8]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sablya-a-9.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Сабля, ＂А＂, 9 тренировка [BBh8dYGlbLY]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/podlodka-vector-search.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Почему текстовый поиск устарел ｜ Векторные базы, эмбеддинги, RAG ｜ Podlodka Podcast #445 [BOWq8JI-XNg]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/podlodka-slm-468.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Маленькие языковые модели ｜ Open source, локальный ИИ, SLM ｜ Podlodka Podcast #468 [x-zjqz1NKic]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/llm-deep-dive-karpathy.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Deep Dive into LLMs like ChatGPT [7xTGNNLPyMI]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/woodcreek-ch1.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Tales From Woodcreek： Chapter 1 (D&D w⧸ Deborah Ann Woll & Iman Vellani) [hmY-MyQhWCk]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/poisk-novogo-ruchya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/НРИ ＂В поисках нового ручья＂ [DqtAHkJHP8A]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/nri-staraya-shahta.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/НРИ： Старая шахта [oX4WKqccJNA]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/context-engineering-29min.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Context Engineering in 29 Minutes： Complete Course [-h9VVJIqtvA]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/obsidian-wiki-karpathy.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Карпатый Wiki Вместо RAG — Полный Obsidian Сетап Для Новичка [2ZHHzfMSeWc]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/kendzyu-pravila-1.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/2026-06-20 18-04-39.MP4 [fpfIBi3iu89wgw]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/kendzyu-sparring-1.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/2026-06-20 19-21-28.MP4 [khRdSa5D98GnbQ]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/almaty-sparring-ali-2026.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/2026-06-20 19-14-21.MP4 [R5lCtXold7lBuA]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/kendzyu-sparring-ali-vov.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/2026-06-20 19-03-27.MP4 [GjobGcxPKqpVxA]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/kendzyu-sparring-oleg-golub.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/2026-06-20 18-29-49.MP4 [4fWW2LY7MOnLUQ]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/kendzyu-sparring-vova-timirbat.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/2026-06-20 19-25-27.MP4 [E2sQUvk6d1ZpTw]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/kendzyu-sparring-ali-andrey.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/2026-06-20 18-54-49.MP4 [vipcX5L50Z3ZHw]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/2026-06-20-185936.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/2026-06-20 18-59-36.MP4 [xVlzHYf3Jp-w6g]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/2026-06-20-18-43-53.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/2026-06-20 18-43-53.MP4 [ntWicTE9syODXQ]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/almaty-sparring-2026-2.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/2026-06-20 19-31-44.MP4 [W2gD47MYKGjJ0A]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/2026-06-20-18-39-45.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/2026-06-20 18-39-45.MP4 [Zm-pcX14FtEwMg]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/protivnik-fehtuet-nepravilno.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Семинар ＂Почему противник фехтует неправильно＂ [ZOMWcjIBUBw]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/mcwilliams-10-aspects.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/№1. Десять аспектов понимания личности и их клинические следствия [MkAxZFRNC24]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/psihologiya-tyazhest-klinicheskaya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/№2. Уровни тяжести и клиническая значимость для психотерапии [HBqRKjGWY8c]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/psihologiya-3-isterechnaya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/№3. Истерическая, гистрионная, посттравматическая и диссоциативная психология [absTrYEkOTE]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/psihologiya-4-depressivnaya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/№4  Депрессивная и мазохистическая психология [eVUKY9Glb24]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/psihologiya-5-shizoidnaya-paranoidnaya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/№5  Шизоидная и параноидная психология [3PaOdcNVS9k]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/psihologiya-6-narcissicheskaya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/№6. Нарциссическая и психопатическая психология [8WnU7n65F5Y]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/retention-club.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Как мы удерживаем людей в фехтовальном клубе (retention) [eNAwTLTHcIU]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/podlodka-naim-ai-482.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Найм в эпоху AI ｜ собеседования, IT найм, рынок труда ｜ Podlodka Podcast #482 [E-P9yqhat3w]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/nikitin-muzhchiny-zhenshiny.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Вся правда о Мужчинах и Женщинах от биолога - почему об этом молчат？ Михаил Никитин [YEP-mICeCwY]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/kontseptsiya-monitoringa.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Концепция мониторинга [cNp1Y79y_28]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/fehtovat-dolgo-ne-travmirovatsya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Как фехтовать долго и не травмироваться [aJsq4RC2MO0]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/hema-prednamerennye-ekspromtnye.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Преднамеренные и экспромтные действия (HEMA, Longsword) [_SUyzJCdh1E]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/optimizatsiya-parad-ripost-hema.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Оптимизация паттернов движений в парад рипостной игре (HEMA, longsword) [hUaWUij5qBk]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/tokarev-silovaya-ofp-2.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Tokarev Coach ｜ 2 серия вебинаров ｜ Силовая тренировка в рамках ОФП [-gxH3seZ2mI]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/silovaya-plan-hema.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Силовая и кондиционная подготовка для фехтовальщиков. Пример составления тренировочного плана (HEMA) [mcI2PmzsK04]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/pliometrika-hema.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Плиометрика для HEMA [6yoZy_vV8Rw]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/kompresiya-taktiki-lektsiya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Компрессия тактики, лекция [E0IuKXUCIYo]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/hema-english-snaryazhenie.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/HEMA English, снаряжение [FgtdB1HjU7I]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/silovaya-konditsiya-hema.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Силовая и кондиционная подготовка для фехтовальщика (HEMA) [oPY4ESTJqhA]/transcript.json'
		)
	},
	{
		reportPath: join(
			root,
			'src/lib/data/reports/printsipy-silovoy-konditsionnoy-podgotovki.json'
		),
		transcriptPath: join(
			pipelineRoot,
			'output/Scientific Training Principles for Strength & Conditioning [X-zQ5hKB_G8]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/obuchenie-situatsiya-subtaktika.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Обучение распознаванию ситуации и выбору субтактик [N14XqcUPMWM]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/subtaktika-teh-realizacii.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Уточнение субтактики на уровне технических реализаций [ebEi5XygfHA]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/fedotikov-mironov.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Евгений Федотиков — Арсений Миронов [vetd_oItl_U]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/trenerskoe-sobranie.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренерское собрание [6GxIqfws7iA]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/trenerskoe-sobranie-novyi-zal.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренерское собрание насчет нового зала [CUJasEMSrrI]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/trenerskoe-sobranie-novyi-zal-chast-2.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренерское собрание насчет зала, часть 2 [Lu-GmLvRbHE]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/trenerskoe-sobranie-novyi-zal-chast-3.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренерское собрание по залу - 3 [WLzbocA5myw]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/trenerskoe-sobranie-novyi-zal-chast-4.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренерское собрание про зал - 4 [RIhEyur8CFs]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/dofamin-neyronnye-svyazi-pasha.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Лекция про дофамин и образование нейронных связей от Паши [RJtk_VuhrzI]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/2026-07-06-19-26-42.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/2026 07 06 19 26 42 [niRY2OltkEU]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/gruppa-a-1-vvodnaya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Группа А   1 тренировка вводная [YvLeEeWsR1k]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/ataka-prosche-ne-byvaet-udar.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/VID 20260707 1943311 [OBZXtQ3b5q4]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/obuchenie-trenerov-poisk-znaniy.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/VID 20260708 181128 [XEsYGTYJY_8]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/trenerstvo-2-zadachi-uprazhneniya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренерство 2.  Как выбирать задачи упражнения [dLlSd2vCzOE]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/trenerskiy-kurs-3-planirovanie-zanyatiy.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренерский курс — 3 [I32n1_3un_g]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/trenerskiy-kurs-4-tekhnika-bezopasnosti.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренерский курс — 4 [gCDSLnrCOUg]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/vid-20260708-200742.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/VID 20260708 200742 [TVWvWIlKO8g]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/utrenniy-kofe-polugodie-strategiya-segmenty.json'),
		transcriptPath: join(pipelineRoot, 'output/утренний кофе/transcript.json')
	},
	{
		reportPath: join(root, 'src/lib/data/reports/pozitsionno-oboronitelnyi-tip-osnovnaya-chast.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренировка А  3 Позиционно оборонительный тип, основная часть [hycpfRnxPdk]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/gruppa-b-2-ataki-fendenti-na-vypade.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренировка Б.  2 Атаки фенденти на выпаде [glbAEboPpG0]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/gruppa-b-3-vybor-zony-i-distantsii-v-atake.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренировка Б-3. Выбор зоны и решения дистанции в атаке [DzFj2NnYulM]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/gruppa-b-4-ataki-na-fone-manevrirovaniya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренировка Б-4. Атаки на фоне маневрирования [jkcHppBI5R4]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/gruppa-b-5-kakari-keiko.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренировка Б-5. Какари кейко [mZ1L1ETPLlo]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/manevrovo-atakuyushchiy-stil.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренировка А  4. 1.   Маневрово атакующий стиль [8ZmsC9cbPdo]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/manevrovo-atakuyushchiy-stil-4-2.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренировка А., 4.2  Маневрово атакующий тип, прожолжение [NCeOwzlFkvg]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/manevrovo-oboronitelnyi-tip.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тренировка А-5. Маневрово-оборонительный тип [RAQLOLc3B2Q]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/tenouti-i-tyakin-sibori.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Тэноути и тякин-сибори [8r6AHwE0PQQ]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/ukol-po-centralnoy-linii.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Семинар ＂Укол по центральной линии  атака, контратака, защита с ответом＂ [92XPlod0yG8]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sudya-gayd-dlya-nachinayushchikh.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Семинар Судья - Гайд для начинающих-AiLLYc0nDiU/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/struktura-i-funktsiya-myshtsy.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Structure and Function of Muscle - CSCS Chapter 1 [xZ3EvSn6ARA]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/neyromyshechnaya-sistema-motornye-edinitsy.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Neuromuscular System - Rate Coding Motor Units and Fiber Types - CSCS Chapter 1 [KNoc23sgWFA]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sem-dvigatelnyh-patternov.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/The 7 Fundamental Movement Patterns - Deep Dive [J8YaoUpH-qg]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/biomehanika-i-myshechnye-rychagi.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Biomechanics and Muscle Leverage - CSCS Chapter 2 [j2uYPNjmsHo]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/sila-moshchnost-i-rabota-v-biomehanike.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Biomechanical Definitions of Strength Power and Work - CSCS Chapter 2 [UBOjpYy8je4]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/tri-rezhima-myshechnogo-deystviya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Muscle Contraction Explained - Concentric Isometric and Eccentric [MFf9dSf7T_Q]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/faktory-myshechnoy-sily-i-moshchnosti.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Factors Affecting Muscle Strength and Power - CSCS Chapter 2 [v2UP700CqA0]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/bioenergetika-trenirovki-tri-energosistemy.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Bioenergetics of Training - 3 Energy Systems - CSCS Chapter 3 [W7xg-U1yLWE]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/laktatnyi-porog-bioenergetika.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Bioenergetics of the Lactate Threshold - CSCS Chapter 3 [lyJxyUaqRUU]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/metabolicheskaya-spetsifichnost-trenirovki.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Metabolic Training Specificity - CSCS Chapter 3 [yDLff_Zrmoo]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/istoschenie-i-vosstanovlenie-substratov.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Substrate Depletion and Repletion - CSCS Chapter 3 [hH62gJVqs6k]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/gormon-myshechnye-vzaimodeystviya.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Hormone-Muscle Interactions - CSCS Chapter 4 [lDUfvVZgdJc]/transcript.json'
		)
	},
	{
		reportPath: join(root, 'src/lib/data/reports/osnovnye-anabolicheskie-gormony.json'),
		transcriptPath: join(
			pipelineRoot,
			'output/Primary Anabolic Hormones - CSCS Chapter 4 [W9Fsf0R3vuU]/transcript.json'
		)
	}
];

function chapterBounds(chapters) {
	return chapters.map((ch, i) => ({
		start: ch.start,
		end: i < chapters.length - 1 ? chapters[i + 1].start : Infinity
	}));
}

function assignSegments(segments, chapters) {
	const bounds = chapterBounds(chapters);
	return chapters.map((ch, i) => {
		const segs = segments
			.filter((s) => s.start >= bounds[i].start && s.start < bounds[i].end)
			.map((s) => ({ start: s.start, text: s.text.trim() }))
			.filter((s) => s.text.length > 0);
		return { ...ch, segments: segs };
	});
}

for (const { reportPath, transcriptPath } of SOURCES) {
	const report = JSON.parse(readFileSync(reportPath, 'utf8'));
	const transcript = JSON.parse(readFileSync(transcriptPath, 'utf8'));
	const segments = transcript.segments ?? [];

	report.chapters = assignSegments(segments, report.chapters);
	if (transcript.full_text) {
		report.transcript = transcript.full_text.trim();
	}

	writeFileSync(reportPath, JSON.stringify(report, null, '\t') + '\n', 'utf8');

	const total = report.chapters.reduce((n, ch) => n + (ch.segments?.length ?? 0), 0);
	console.log(`${report.slug}: ${total} сегментов в ${report.chapters.length} блоках`);
}

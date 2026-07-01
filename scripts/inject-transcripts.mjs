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

import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const previous=read('scripts/search-enrichment/relevance-reviewed-v1.json');
const baseRaw=readFileSync('scripts/search-enrichment/pilot-registry.json','utf8'),base=JSON.parse(baseRaw);
const report=s=>read(`src/lib/data/reports/${s}.json`);
const get=(o,p)=>p.reduce((v,k)=>v[k],o);
function j(slug,path,selector,grade,supports,quotes,reason){const source=get(report(slug),path);return {reportSlug:slug,path,selector,grade,supports,evidence:quotes.map(p=>get(source,p)),sourceHash:hash(JSON.stringify(source)),reason};}
const ch=(s,i,f,quotes,reason)=>j(s,['chapters',i],{chapterIndex:i},3,[f],quotes,reason);
const note=(s,i,f,quotes,reason)=>j(s,['seminar_notes',i],{kind:'material',title:'Конспект: '+report(s).seminar_notes[i].title},3,[f],quotes,reason);
const ex=(s,sec,i,g,f,reason)=>{const section=report(s).seminar_exercises[sec];return j(s,['seminar_exercises',sec,'items',i],{kind:'material',title:'Упражнения: '+section.title,start:section.items[i].start},g,f,[['text']],reason);};
const b='mech-i-bakler-mikrotsikl-1-osnovy',c='soedinenie-dlinnyi-mech-lager-noname-1',m='kontseptsiya-monitoringa',h='hema-prednamerennye-ekspromtnye',t='2026-07-06-19-26-42',l='longsword-a';
const defs=[
 ['p-multi-1',['sabre','Причина ненадёжности захвата гибкой сабли'],['winden','Условие выполнения силового виндена'],[
 ch('sablya-a-3',2,'sabre',[['theses',0]],'Гибкий клинок отгибается при захвате и сохраняет возможность попасть.'),
 ch(l,14,'winden',[['theses',1]],'Силовой винден требует преднамеренного выигрыша соединения; не подменять уступающим вариантом.')]],
 ['p-multi-2',['miss','Действие при отсутствии контакта после собственного батмана'],['threat','Ограничение переноса при чужом батмане против угрозы'],[
 ch('sablya-a-5',7,'miss',[['summary'],['theses',1]],'Без ощущения клинка требуется работа ног; автоматическое продолжение ударом не обосновано.'),
 ch(t,3,'threat',[['theses',2]],'Чужой батман входит в явно названные исключения для механического переноса.')]],
 ['p-multi-3',['entry','Обратимый вход ногами'],['structure','Проверка опоры руки с баклером'],[
 ch(c,3,'entry',[['theses',0],['theses',1]],'Расширение не обязывает завершать шаг и сохраняет возможность уйти.'),
 note(c,1,'entry',[['items',0],['items',2]],'Даны короткое расширение, свободная задняя нога и ограничение переноса веса для отхода.'),
 ch(b,7,'structure',[['theses',3]],'Положение проверяется давлением при прямой линии руки.'),
 ex(b,0,11,3,['structure'],'Конкретная проверка баклера нагрузкой на полу, а не любое упражнение раздела.')]],
 ['p-multi-4',['falso','Оппозиция при уколе из фальса'],['buckler','Контроль чужого клинка после отхода с баклером'],[
 ch(l,7,'falso',[['theses',1],['theses',2]],'Выпрямление сильной части и подсаживание обеспечивают контроль встречного.'),
 ch(b,14,'buckler',[['theses',0],['theses',1],['theses',3]],'Отход и укол связаны удержанием контакта баклером с оружием.'),
 note(b,4,'buckler',[['items',1],['items',2]],'Конспект прямо сохраняет контроль оружия во время верхнего укола.'),
 ex(b,0,15,2,[],'Краткое упражнение называет толчок и укол, но не объясняет удержание контроля; это частичная поддержка.')]],
 ['p-multi-5',['balls','Постепенное усложнение работы двумя мячами'],['pace','Изменение темпа под уровень ученика'],[
 ch(b,3,'balls',[['theses',0],['theses',1],['theses',2]],'Источник содержит последовательность усложнения, а не только один трудный вариант.'),
 note(b,2,'balls',[['items',1]],'Переход от симметричных бросков к разведению ритма и направления ловли.'),
 ch(m,3,'pace',[['theses',0],['theses',1],['theses',2]],'Замедление для новичка и усложнение при освоении.'),
 ex(b,0,7,2,[],'Один сложный способ ловли сам по себе не описывает последовательность обучения.')]],
 ['p-multi-6',['student','Ошибка ранней защиты ученика'],['monitor','Ложный успех из-за недоведённого удара партнёра'],[
 ch(h,1,'student',[['theses',0]],'Ученик заранее выбирает защиту без наблюдения за атакой.'),
 ch(m,4,'monitor',[['summary'],['theses',0]],'Остановка удара монитора даёт ложное ощущение успеха; это другая причина ошибки.')]],
 ['p-multi-7',['decision','Время на распознавание и выбор подготовленного ответа'],['adapt','Подстройка темпа монитора под новичка'],[
 ch(h,7,'decision',[['summary'],['theses',0],['theses',1]],'Объяснение дано в рамках модели автора: обработка и выбор решения занимают время.'),
 ch(m,3,'adapt',[['theses',0],['theses',1]],'Монитор замедляется для новичка и повышает темп при освоении.')]],
 ['p-multi-8',['branch','Упрощение до одной ветки угрозы'],['trigger','Упрощение до пускового движения задней ноги'],[
 ch(t,4,'branch',[['theses',0]],'Вместо всех ответов одновременно углубляется одна ветка.'),
 ch(c,7,'trigger',[['summary'],['theses',0]],'Оставляется один пусковой сигнал для уменьшения координационной нагрузки.'),
 ex(c,0,3,3,['trigger'],'Конкретное упражнение запускает руки задней ногой и исключает переднюю из внимания.')]]
];
const additions=defs.map(([id,a,b,judgments])=>{const q=base.cases.find(q=>q.id===id);return {id,query:q.query,originalJudgments:q.judgments,facets:[a,b].map(([id,label])=>({id,label})),reason:'Вопрос явно сопоставляет две разные ситуации. Сохраняются два требования к информации; допустимы подтверждённые альтернативные источники.',judgments};});
const result={version:2,protocol:{...previous.protocol,previousReviewSha256:hash(readFileSync('scripts/search-enrichment/relevance-reviewed-v1.json')),baseRegistrySha256:hash(baseRaw),scope:'All 12 existing multi-source questions plus one game query; same author, source-reviewed, not independent human gold. Previous five cases copied unchanged.'},cases:[...previous.cases,...additions]};
const raw=JSON.stringify(result,null,2)+'\n',path='scripts/search-enrichment/relevance-reviewed-v2.json';
if(existsSync(path)&&readFileSync(path,'utf8')!==raw)throw Error('Frozen review changed; create a new revision');
if(!process.argv.includes('--dry-run')){writeFileSync(path,raw);writeFileSync(path.replace('.json','.sha256'),hash(raw)+'\n');}
console.log(JSON.stringify({ok:true,cases:result.cases.length,judgments:result.cases.reduce((n,c)=>n+c.judgments.length,0),sha256:hash(raw)}));

import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const raw=readFileSync('scripts/search-enrichment/pilot-expanded.json','utf8'),original=JSON.parse(raw);
const report=s=>JSON.parse(readFileSync(`src/lib/data/reports/${s}.json`,'utf8'));
const get=(o,path)=>path.reduce((v,k)=>v[k],o);
function judgment(slug,path,selector,grade,supports,quotePaths,reason){
 const source=get(report(slug),path);
 return {reportSlug:slug,path,selector,grade,supports,evidence:quotePaths.map(p=>get(source,p)),sourceHash:hash(JSON.stringify(source)),reason};
}
const chapter=(s,i,g,f,why)=>judgment(s,['chapters',i],{chapterIndex:i},g,f,[['summary']],why);
const buckler='mech-i-bakler-mikrotsikl-1-osnovy',monitor='kontseptsiya-monitoringa';
const exercise=(i,g,f,why)=>{
 const s=report(buckler).seminar_exercises[0];return judgment(buckler,['seminar_exercises',0,'items',i],{kind:'material',title:`Упражнения: ${s.title}`,start:s.items[i].start},g,f,[['text']],why);
};
const defs=[
 ['expanded-multi-1',[['movement','Полноценное завершение атакующего движения'],['distortion','Объяснение искажения учебного результата']],
 'Два источника описывают перекрывающиеся требования. Не обязательно найти именно оба, если один объясняет и действие, и учебную ошибку.',[
 chapter('sablya-a-5',5,3,['movement','distortion'],'Завершение атаки необходимо для проверки тайминга; без динамики получается другое действие.'),
 chapter(monitor,4,3,['movement','distortion'],'Полноценный удар противопоставлен остановленному; названа причина ложного ощущения успеха.'),
 chapter(monitor,1,1,[],'Общий принцип релевантной адаптации полезен, но не объясняет конкретную ошибку недоведённой атаки.')]],
 ['expanded-multi-2',[['continuation','Продолжение после проигрыша соединения с сохранением контроля']],
 'Вопрос просит решение одной ситуации, а не два разных приёма. Винден — условный дополнительный пример, а не обязательный второй источник.',[
 chapter('soedinenie-dlinnyi-mech-lager-noname-1',15,3,['continuation'],'Прямо описаны проигрыш соединения, сохранение контакта, подвешенная секста и нападение с другой стороны; выбор зависит от дистанции.'),
 judgment('longsword-a',['chapters',14],{chapterIndex:14},2,[],[['theses',0]],'Уступающий винден описан при давлении защиты. Это полезный частный случай, но не универсальный ответ после любого проигрыша соединения.')]],
 ['expanded-multi-3',[['steps','Сохранение опоры при передвижении'],['switch','Смена ведущей ноги без разрушения стойки']],
 'Сохраняются две разные части задачи. Конспект может покрыть обе, упражнения оцениваются по конкретному пункту и времени.',[
 chapter(buckler,4,3,['steps'],'Описаны опора и проверка обеих ног после шага.'),
 chapter(buckler,5,3,['switch'],'Описана смена ведущей ноги без потери ширины опоры.'),
 judgment(buckler,['seminar_notes',1],{kind:'material',title:'Конспект: Стойка и работа ног'},3,['steps','switch'],[['items',0],['items',2],['items',3]],'Конспект явно содержит проверку стойки при шагах и смену ведущей ноги.'),
 exercise(8,3,['steps'],'Проверка обеих стоп после приставного шага.'),
 exercise(9,3,['switch'],'Шаффл со сбором, раскрытием стойки и сменой ведущей ноги.'),
 exercise(15,1,[],'Связка dritto и укола содержит смену ноги, но не объясняет устойчивость; не засчитывается только за совпадение названия раздела.')]],
 ['expanded-multi-4',[['prepared','Выбор отработанного решения после распознавания сигнала'],['threat','Применение распознавания в тренировке угрозы']],
 'Разделены общий механизм подготовленного решения и его применение к угрозе; один общий текст не заменяет оба аспекта.',[
 chapter('hema-prednamerennye-ekspromtnye',7,3,['prepared'],'Прямо указаны распознавание сигнала и выбор отработанного решения.'),
 chapter('2026-07-06-19-26-42',4,3,['threat'],'Упражнение связывает распознавание ситуации и реализацию угрозы, углубляя одну ветку ответов.')]],
 ['expanded-5-3-original',[['game','Идентификация игрового упражнения на вызов нижней атаки и выход']],
 'Конкретное упражнение является допустимой альтернативой главе. Другие упражнения с тем же заголовком не являются ответом.',[
 chapter(buckler,19,3,['game'],'Игра ниндзя и самурай прямо соответствует запросу.'),
 exercise(17,3,['game'],'Указана конкретная игра: вход и выход из зоны, атака ниже колена.'),
 exercise(4,0,[],'Прыжки вперёд и назад не являются игрой на вызов нижней атаки.'),
 exercise(15,0,[],'Парная связка dritto и укола не отвечает запросу об игровом задании.')]]
];
const data={version:1,protocol:{originalRegistrySha256:hash(raw),author:'Codex',scope:'Five source-reviewed cases from disclosed expanded pilot; source-grounded interpretation, not independent human gold or an algorithm change.',coverage:'Judged sources only; unjudged hits remain unknown. Chapter matches mean access to that chapter, not proof that the displayed snippet answers the question. Timed exercise items require matching start as well as title.',reason:'Separate requested information from an arbitrary number of expected chapters; distinguish concrete exercise items.'},cases:defs.map(([id,facets,reason,judgments])=>{
 const old=original.cases.find(q=>q.id===id);return {id,query:old.query,originalJudgments:old.judgments,facets:facets.map(([id,label])=>({id,label})),reason,judgments};
})};
const text=JSON.stringify(data,null,2)+'\n',path='scripts/search-enrichment/relevance-reviewed-v1.json';
if(existsSync(path)&&readFileSync(path,'utf8')!==text)throw Error('Frozen review changed; create a new revision');
if(!process.argv.includes('--dry-run')){writeFileSync(path,text);writeFileSync(path.replace('.json','.sha256'),hash(text)+'\n');}
console.log(JSON.stringify({ok:true,dryRun:process.argv.includes('--dry-run'),cases:data.cases.length,judgments:data.cases.reduce((n,c)=>n+c.judgments.length,0),sha256:hash(text)}));

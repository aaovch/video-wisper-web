import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash} from './core.mjs';
const questions=[
 ['ii-dlya-analiza-hema-boev',10,'Может ли один профиль HEMA-бойца поддерживать противоположные гипотезы тренера?'],
 ['hema-english-snaryazhenie',5,'Как по-английски называются пах, таз и бедро?'],
 ['tokarev-silovaya-ofp-2',50,'Какой метод силовой ОФП связан с гипертрофией и средним числом повторений?'],
 ['printsipy-silovoy-konditsionnoy-podgotovki',4,'Зачем в силовой подготовке менять упражнения по плану, а не случайно?'],
 ['gruppa-b-3-vybor-zony-i-distantsii-v-atake',8,'Как выбирать выпад по удалённости цели в упражнениях группы Б?'],
 ['manevrovo-oboronitelnyi-tip',4,'Как работает ногами маневровый защитник после отхода назад?'],
 ['retention',8,'Какие условия помогают разным атлетам оставаться в одной группе?'],
 ['kompresiya-taktiki-lektsiya',6,'У опытного бойца одна огромная тактическая модель или несколько маленьких?'],
 ['tenouti-i-tyakin-sibori',4,'Зачем в первом упражнении тэноути расслаблять руки и делать широкий удар?'],
 ['kinezio-trenirovka-3-tazobedrennyy-sustav',15,'Как выбрать гантель и защитить колено перед упражнением на тазобедренный сустав?'],
 ['kurs-dlya-trenerov-noname-3-formirovanie-dvigatelnogo-navyka',10,'Почему подробное объяснение удара тренером ещё не учит правильному движению?'],
 ['podgotovka-ataki-na-sable-korotovskih',7,'Как в сабельном упражнении выбирать атаку, если монитор остановился или продолжает движение?'],
 ['fedotikov-mironov',4,'Как Миронов подготовил попадание в руки Федотикову?'],
 ['dofamin-neyronnye-svyazi-pasha',9,'Почему боец поднимает защиту головы до распознавания сектора атаки?'],
 ['pitanie-i-ves-fekhtovalshchika-turin',10,'Почему Турин связывает быстрое похудение с откатом веса?']
];
const data={version:1,protocol:{unlockedHemaCollections:true,author:'Codex',note:'Source-aware same-author sample, frozen before context import. Exact summaries are evidence; this is not an independent holdout or proof of all-corpus quality.'},cases:questions.map(([slug,index,query],i)=>{
 const report=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
 return {id:`context-${i+1}`,query,kind:'single',split:'holdout',coverage:'single',scopes:['report','collection','archive'],judgments:[{reportSlug:slug,chapterIndex:index,grade:3,evidence:report.chapters[index].summary,sourceHash:sourceHash(sourceFor(report,index))}]};
})};
const raw=JSON.stringify(data,null,2)+'\n';
writeFileSync('scripts/search-enrichment/context-registry.json',raw);
writeFileSync('scripts/search-enrichment/context-registry.sha256',createHash('sha256').update(raw).digest('hex')+'\n');

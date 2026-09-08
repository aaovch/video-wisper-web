import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash} from './core.mjs';
const sword=s=>'soedinenie-dlinnyi-mech-lager-noname-'+s;
const sabre=s=>'avstriyskaya-sablya-'+s;
const questions=[
 ['single','Партнёр отдал захват, но остался далеко. Обязательно ли продолжать нападение?',[[sword('2-utro'),19]]],
 ['single','При проверке рычага я всё время сбиваю чужой меч. Как чувствовать контакт мягче?',[[sword('2-utro'),10]]],
 ['single','После потери линии меч описывает большой круг. Как возвращать контакт экономнее?',[[sword('3'),4]]],
 ['single','Человек спрятал меч на плечо, и захватить нечего. Как вернуть его оружие на центр?',[[sword('4'),9]]],
 ['single','Получаю по кистям сверху, когда пробую колоть с соединением. Куда направить гарду?',[[sword('7'),14]]],
 ['single','На ранний контрзахват всегда ли нужен повторный перевод или вблизи есть другой ответ?',[[sword('poteryannaya'),5]]],
 ['single','Можно ли просто идти вперёд, когда чужое острие смотрит прямо в меня?',[[sabre('2'),12]]],
 ['single','Как обойти закрывающийся сектор рапирным переводом, не столкнувшись с защитой?',[[sabre('trenirovka-3'),3]]],
 ['single','Я опускаю руку вниз, но поддевка всё равно попадает. Что должно разворачиваться в девятке?',[[sabre('obratnoe-lezvie'),7]]],
 ['single','Вторая защита получается ударом по оружию, а круговой ответ разваливается. Как выполнять мягче?',[[sabre('trenirovka-5-povtorenie'),15]]],
 ['single','Когда выбирать финт, а когда сначала сбивать выставленный клинок?',[[sabre('trenirovka-6-batmany-vybor'),16]]],
 ['single','Если на показ в голову никто не защищается, надо заранее переносить удар на руку?',[[sabre('trenirovka-5-povtorenie'),19]]],
 ['multi','Как выманить спрятанный на плече меч и после этого читать встречное давление в захвате?',[[sword('4'),9],[sword('3'),6]]],
 ['multi','Как не ошибиться с выбором батмана или финта и не потерять преимущество широким замахом?',[[sabre('trenirovka-6-batmany-vybor'),16],[sabre('trenirovka-6-batmany-vybor'),4]]],
 ['multi','Как различается ответ обратной кромкой после первой защиты вдали и в тесной позиции?',[[sabre('obratnoe-lezvie'),14],[sabre('obratnoe-lezvie'),15]]],
 ['multi','Как научиться чувствовать соединение без зрения и зачем это ограничение используется в обучении?',[[sword('2-utro'),13],[sword('2-utro'),15]]],
 ['unsupported','Какой процент моих попаданий батманом улучшился после лагеря?',[[sabre('trenirovka-6-batmany-vybor'),18]]],
 ['unsupported','Какую оценку тренер поставил моему захвату на вчерашнем спарринге?',[[sword('7'),16]]]
];
const registry={version:1,protocol:{author:'Codex',note:'Same-author source-aware evaluation after fixing candidate text. Personal-result negatives have related sources but no answer. Frozen before first run.'},cases:questions.map(([kind,query,refs],i)=>({id:`noname-${i+1}`,query,kind,split:'holdout',coverage:kind,scopes:kind==='multi'?['collection','archive']:['report','collection','archive'],judgments:refs.map(([slug,index])=>{
 const report=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
 return {reportSlug:slug,chapterIndex:index,grade:kind==='unsupported'?1:3,evidence:report.chapters[index].summary,sourceHash:sourceHash(sourceFor(report,index))};
})}))};
const raw=JSON.stringify(registry,null,2)+'\n';writeFileSync('scripts/search-enrichment/noname-registry.json',raw);
writeFileSync('scripts/search-enrichment/noname-registry.sha256',createHash('sha256').update(raw).digest('hex')+'\n');

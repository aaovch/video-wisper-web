import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash} from './core.mjs';
const questions=[
 ['sablya-vvodnaya',5,'На разминке шаг короткий, а перед соперником разрастается. Как контролировать длину подготовки?'],
 ['sablya-a-2',3,'Партнёр закрыл голову пятёркой: в подводящем упражнении касаться его сабли или остановиться?'],
 ['sablya-4',3,'Показал укол, но реакции нет. Нужно всё равно менять направление?'],
 ['sablya-6',5,'Зачем два отдельных темпа, если одним шагом можно пройти ту же дистанцию?'],
 ['sablya-a-7',6,'Прячу руку от батмана и получаю навстречу. В чём компромисс?'],
 ['sablya-8',8,'Как сделать так, чтобы успеть заметить контратаку и взять её на движении вперёд?'],
 ['sablya-a-9',4,'В начале чужой атаки что выбирать при выставленной и при прижатой руке?'],
 ['sablya-10',1,'Как организовать отдых между короткими повторениями со счётом?'],
 ['sablya-12',3,'Сколько возможных продолжений стоит выбирать под одного соперника, чтобы не перегрузиться?'],
 ['rapira-almaty-2026',3,'Переношу сабельную тройку на рапиру, но угрозы не получается. Что поменять в кисти?'],
 ['prostaya-ataka-mikrotsikl-1-dlinnyy-mech',11,'Меч застревает на руке после моего попадания, и я пропускаю ответ сверху. Что делать после контакта?'],
 ['prostaya-ataka-mikrotsikl-1-dlinnyy-mech',15,'Как готовить удар из короткой позиции, не показывая противнику исчезновение угрозы?']
];
const registry={version:1,protocol:{author:'Codex',note:'Source-aware same-author checks after candidate text was fixed; not independent human gold. Frozen before rollout evaluation.'},cases:questions.map(([slug,index,query],i)=>{
 const report=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
 return {id:`rollout-${i+1}`,query,kind:'single',split:'holdout',coverage:'rollout',scopes:['report','collection','archive'],judgments:[{reportSlug:slug,chapterIndex:index,grade:3,evidence:report.chapters[index].summary,sourceHash:sourceHash(sourceFor(report,index))}]};
})};
const raw=JSON.stringify(registry,null,2)+'\n';
writeFileSync('scripts/search-enrichment/rollout-registry.json',raw);
writeFileSync('scripts/search-enrichment/rollout-registry.sha256',createHash('sha256').update(raw).digest('hex')+'\n');

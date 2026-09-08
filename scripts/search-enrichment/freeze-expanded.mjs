import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash} from './core.mjs';
const slugs=JSON.parse(readFileSync('scripts/search-enrichment/pilot-card-spec.json','utf8')).map(s=>s.slug);
// Authored after the expanded card revision was fixed, before observing this evaluation.
const questions=[
 [[1,'Почему нападение с выдвинутой рукой трудно отбить, если соперник не трогает моё оружие?','выдвинутой','выдвинтой'],[5,'Какие быстрые сбивы требуют особенно точного момента встречи?','быстрые','быстые'],[9,'Соперник тормозит перед моим воздействием на клинок. Как достать его и не упасть вперёд?','тормозит','тормзит']],
 [[2,'Не получается начать мулинет из моего положения. На каком шаге подготовить оружие?','положения','положния'],[5,'На отработке партнёр не заканчивает нападение. Почему это мешает тренировать батман?','заканчивает','заканчивет'],[6,'Как намеренно вызвать чужой удар своим движением сабли и оставить его без попадания?','намеренно','намерено']],
 [[9,'У меня лучше рычаг, но путь к цели ещё закрыт. Достаточно ли этого преимущества для нападения?','преимущества','преимущства'],[12,'Как проверить качество только что взятого контакта, не подправляя его во время проверки?','качество','качство'],[21,'Как спрятать вход в глубокий захват от собранного противника?','собранного','собраного']],
 [[4,'Как увеличить дальность рубки и не показать заранее её сторону?','увеличить','увелчить'],[12,'Почему для укола из фальса не нужен тот же перевод, что из центрального положения?','центрального','централного'],[20,'Что сделать кистью после встречи с чужой защитой, чтобы пресечь поздний ответный удар?','пресечь','пресеч']],
 [[5,'Как быстро поменять переднюю ногу с мечом и баклером, сохранив широкую опору?','переднюю','передню'],[15,'Как доколоть вблизи, когда нет места для длинного движения вперёд?','длинного','длиного'],[19,'Какое игровое упражнение учит вызвать удар в ноги и вовремя уйти?','игровое','игрове']],
 [[4,'Из каких этапов складывается выбор действия после сигнала в боевой фразе?','складывается','складывется'],[5,'Почему заранее решённая атака может быть быстрой и чистой, но уйти не в ту цель?','заранее','заране'],[6,'Почему мгновенный ответ на неожиданность часто обрывает начатое движение?','неожиданность','неожиданость']],
 [[0,'Что должен обеспечивать помогающий партнёр для выполнения учебной задачи?','обеспечивать','обеспечвать'],[2,'Чем различаются стимулы для обучения чтению нападения и для скоростной защитной реакции?','различаются','различатся'],[5,'Нужно ли после медленного тренировочного удара продолжать нажим на оружие новичка?','продолжать','продолжть']],
 [[1,'Зачем угрожающее положение выделять отдельно, если оно уже похоже на нападение?','угрожающее','угрожающе'],[2,'Я выставил остриё, а оппонент никак не отвечает. Как завершить созданную угрозу?','созданную','созданую'],[3,'Всегда ли перенос подходит после того, как соперник убрал мой клинок с линии?','подходит','подхдит']]
];
const judge=(slug,i)=>{const r=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));return {reportSlug:slug,chapterIndex:i,grade:3,title:r.chapters[i].title,evidence:r.chapters[i].summary,sourceHash:sourceHash(sourceFor(r,i))};};
const cases=questions.flatMap((qs,r)=>qs.flatMap(([i,query,correct,typo],j)=>{
 if(!query.includes(correct))throw Error('Missing typo token');
 return [query,query.replace(correct,typo)].map((q,v)=>({id:`expanded-${r+1}-${j+1}-${v?'typo':'original'}`,familyId:`expanded-${r+1}-${j+1}`,variant:v?'typo':'original',kind:'single',split:'holdout',query:q,scopes:['report','collection','archive'],judgments:[judge(slugs[r],i)]}));
}));
const multi=[
 ['Какие ошибки партнёра искажают отработку атаки: её завершение и доведение удара?',[[1,5],[6,4]]],
 ['Как сохранить возможность продолжения, если контакт с чужим оружием проигран?',[[2,15],[3,14]]],
 ['Как обеспечить устойчивость при перемещении и смене ног в упражнениях с баклером?',[[4,4],[4,5]]],
 ['Как подготовленные решения сочетаются с распознаванием ситуации угрозы?',[[5,7],[7,4]]]
];
multi.forEach(([query,refs],i)=>cases.push({id:`expanded-multi-${i+1}`,kind:'multi',split:'holdout',query,scopes:['archive'],judgments:refs.map(([r,c])=>judge(slugs[r],c))}));
// Personal facts absent from this archive; related chapter is not an answer.
['Сколько раз я вчера потерял равновесие после батмана?','Какую именно ошибку моего хвата исправлял тренер на последнем занятии?','Какой у меня процент успешных контратак с баклером за август?','На какой скорости лично я перестаю распознавать сигнал монитора?'].forEach((query,i)=>cases.push({id:`expanded-unsupported-${i+1}`,kind:'unsupported',split:'holdout',query,scopes:['report'],missingInformation:'В источнике отсутствуют личные наблюдения и измерения пользователя.',judgments:[{...judge(slugs[[0,2,4,6][i]],[9,12,16,2][i]),grade:1}]}));
const fingerprint=createHash('sha256');for(const s of slugs)fingerprint.update(readFileSync(`src/lib/data/search-cards/${s}.json`));
const d={version:1,protocol:{author:'Codex',revision:'expanded-113',cardFingerprint:fingerprint.digest('hex'),reason:'Prospective check after full chapter coverage, three topics per report with paired typo variants.',limitations:'Same author as cards; not independent human judgments. This is a new evaluation of known source topics. Previous disclosed results remain unchanged.'},cases};
const raw=JSON.stringify(d,null,2)+'\n',hash=createHash('sha256').update(raw).digest('hex');
const path='scripts/search-enrichment/pilot-expanded.json';
if(existsSync(path)&&readFileSync(path,'utf8')!==raw)throw Error('Frozen experiment differs; create a new revision instead of overwriting');
if(!process.argv.includes('--dry-run')){writeFileSync(path,raw);writeFileSync(path.replace('.json','.sha256'),hash+'\n');}
console.log(JSON.stringify({ok:true,dryRun:process.argv.includes('--dry-run'),questions:cases.length,hash}));

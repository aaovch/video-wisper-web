import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash} from './core.mjs';
import {validateSourceLinks} from './source-links.mjs';
const read=slug=>JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
const previous=JSON.parse(readFileSync('scripts/search-enrichment/source-links-v1.json','utf8'));
const specs=[
 ['position-checks','Две разные проверки управляемой позиции: возможность продолжить движение ногами и устойчивость руки под давлением на баклер. Одна не заменяет другую.',[
  ['soedinenie-dlinnyi-mech-lager-noname-1',3,'Обратимый вход с возможностью отхода'],['mech-i-bakler-mikrotsikl-1-osnovy',7,'Проверка структуры руки давлением на баклер']]],
 ['coordination-progression','Постепенное усложнение показано в двух форматах: координация мячами и темп работы монитора. Это разные упражнения с отдельными критериями выполнения.',[
  ['mech-i-bakler-mikrotsikl-1-osnovy',3,'Прогрессия одновременных и перекрёстных бросков'],['kontseptsiya-monitoringa',3,'Подбор темпа и предсигналов под уровень ученика']]],
 ['student-monitor-errors','Раннюю защиту без распознавания и ложный успех из-за остановленного удара нужно различать: первая ошибка относится к решению ученика, вторая — к стимулу партнёра.',[
  ['hema-prednamerennye-ekspromtnye',1,'Ошибки распознавания и завершения реакции'],['kontseptsiya-monitoringa',4,'Искажение упражнения недоведённым ударом']]],
 ['reduce-training-load','Два способа уменьшить сложность упражнения: оставить одну ветку решений или один двигательный сигнал. Тактическое ограничение не равно механике входа.',[
  ['2026-07-06-19-26-42',4,'Одна ветка угрозы и распознавание ситуации'],['soedinenie-dlinnyi-mech-lager-noname-1',7,'Задняя нога как единственный сигнал для рук']]],
 ['recognition-prepared-actions','Подготовленное решение выбирается по сигналу; упражнение связывает распознавание ситуации с реализацией угрозы. Модель выбора и учебная постановка дополняют друг друга.',[
  ['hema-prednamerennye-ekspromtnye',7,'Выбор отработанного решения после сигнала'],['2026-07-06-19-26-42',4,'Распознавание, субтактика и завершение угрозы']]],
 ['beat-choice-execution','Выбор батмана зависит от положения чужого клинка, а сохранение его преимущества — от короткого импульса и немедленного продолжения. Выбор действия и исполнение разбираются отдельно.',[
  ['avstriyskaya-sablya-trenirovka-6-batmany-vybor',16,'Различение сигналов для финта и батмана'],['avstriyskaya-sablya-trenirovka-6-batmany-vybor',4,'Короткий импульс вместо широкого замаха']]]
];
const added=specs.map(([id,explanation,refs])=>({id,explanation,generator:'Codex; source-reviewed relationship expansion v2',sources:refs.map(([slug,index,role])=>{const r=read(slug),c=r.chapters[index];return {reportSlug:slug,chapterIndex:index,sourceHash:sourceHash(sourceFor(r,index)),reportTitle:r.title,title:c.title,start:c.start,role,evidence:c.summary};})}));
const data={...previous,links:[...previous.links,...added]};validateSourceLinks(data,read);
const raw=JSON.stringify(data,null,2)+'\n',hash=createHash('sha256').update(raw).digest('hex');
if(hash!=='a223f84c4910434e614e556960adb3666c084e45a6b9cdf29cec44b7efba7808')throw Error('Reviewed v2 sources changed; review relationships before refreshing hashes');
if(process.argv.includes('--apply')){
 const current=readFileSync('src/lib/data/search-source-links.json','utf8');
 if(JSON.stringify(JSON.parse(current))!==JSON.stringify(previous)&&current!==raw)throw Error('Existing graph changed; preserve concurrent work');
 writeFileSync('src/lib/data/search-source-links.json',raw);
}
console.log(JSON.stringify({ok:true,dryRun:!process.argv.includes('--apply'),links:data.links.length,hash}));

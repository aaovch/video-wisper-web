import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash} from './core.mjs';
import {validateSourceLinks} from './source-links.mjs';
const read=slug=>JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
const specs=[
 ['support-footwork','Два упражнения о сохранении опоры: приставной шаг и смена ведущей ноги. Условия выполнения различаются.',[
  ['mech-i-bakler-mikrotsikl-1-osnovy',4,'Проверка стойки и обеих ног после шага'],['mech-i-bakler-mikrotsikl-1-osnovy',5,'Сохранение ширины опоры при смене ноги']]],
 ['contact-continuation','Продолжение при проигрыше соединения и уступающий винден на давлении — разные варианты работы с контактом, а не взаимозаменяемые команды.',[
  ['soedinenie-dlinnyi-mech-lager-noname-1',15,'Учебный ответ через подвешенную сексту'],['longsword-a',14,'Уступающий винден; отличие от силового']]],
 ['decision-tempo','Выбор подготовленного ответа требует времени; темп монитора адаптируется к уровню ученика. Связь между моделью решения и организацией упражнения.',[
  ['hema-prednamerennye-ekspromtnye',7,'Время обработки сигнала и выбора решения'],['kontseptsiya-monitoringa',3,'Замедление и усложнение под уровень ученика']]],
 ['partner-completion','Два контекста полноценной атаки партнёра: динамика батмана и достоверный стимул в мониторинге. Это примеры одного учебного принципа.',[
  ['sablya-a-5',5,'Завершение атаки при отработке батмана'],['kontseptsiya-monitoringa',4,'Недоведённый удар и ложный успех защиты']]]
];
const data={version:1,links:specs.map(([id,explanation,refs])=>({id,explanation,generator:'Codex; source-reviewed relationship pilot v1',sources:refs.map(([slug,index,role])=>{const r=read(slug),c=r.chapters[index];return {reportSlug:slug,chapterIndex:index,sourceHash:sourceHash(sourceFor(r,index)),reportTitle:r.title,title:c.title,start:c.start,role,evidence:c.summary};})}))};
validateSourceLinks(data,read);
const raw=JSON.stringify(data,null,2)+'\n';
// Freeze this reviewed pilot. Changed sources need a new semantic review, not refreshed hashes.
if(createHash('sha256').update(raw).digest('hex')!=='07b05a2e0b593d4f9d22d2ed310e9e9ef93636be6b08756c329216ba58bffbb2')throw Error('Reviewed link pilot changed; reread sources and review relationships before updating the frozen candidate.');
if(process.argv.includes('--apply')){
 const existing=readFileSync('src/lib/data/search-source-links.json','utf8');
 if(existing!==raw)throw Error('Existing graph differs from v1; do not overwrite a later revision');
 writeFileSync('src/lib/data/search-source-links.json',raw);
}
console.log(JSON.stringify({ok:true,dryRun:!process.argv.includes('--apply'),links:data.links.length}));

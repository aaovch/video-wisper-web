import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash} from './core.mjs';
const rows=[
 ['longsword-a',4,'Как навершие помогает скрыть направление длинного рубящего удара?'],
 ['longsword-a',20,'Чем погасить афтерблоу после попадания моего меча в защиту?'],
 ['hema-prednamerennye-ekspromtnye',5,'Почему заранее запущенная последовательность может пройти без задержки, но ошибиться сектором?'],
 ['avstriyskaya-sablya-obratnoe-lezvie',7,'В девятой защите от поддевки нужно опускать руку или поворачивать клинок пальцами?'],
 ['longsword-a',5,'Почему при уколе с центра не надо подавать плечи вперёд?'],
 ['longsword-a',19,'Почему привычная средняя дистанция мешает использовать длинный удар по гипотенузе?'],
 ['hema-prednamerennye-ekspromtnye',6,'Чем опасна быстрая реакция с прерыванием собственного движения на приоритетный сигнал?']
];
const data={version:1,protocol:{author:'Codex',note:'Source-aware confirmation after fixing adjacent-title candidate; disclosed themes, new wording, not independent holdout. Includes neighboring chapters as controls.'},cases:rows.map(([slug,index,query],i)=>{const r=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));return {id:`neighbor-confirm-${i+1}`,kind:'single',coverage:'single',query,split:'holdout',scopes:['report','collection','archive'],judgments:[{reportSlug:slug,chapterIndex:index,grade:3,evidence:r.chapters[index].summary,sourceHash:sourceHash(sourceFor(r,index))}]};})};
const raw=JSON.stringify(data,null,2)+'\n';writeFileSync('scripts/search-enrichment/neighbor-confirmation.json',raw);writeFileSync('scripts/search-enrichment/neighbor-confirmation.sha256',createHash('sha256').update(raw).digest('hex')+'\n');

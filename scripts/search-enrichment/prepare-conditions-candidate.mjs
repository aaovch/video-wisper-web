import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateCards} from './cards.mjs';
const slug='mech-i-bakler-mikrotsikl-1-osnovy';
const report=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
const data=JSON.parse(readFileSync(`src/lib/data/search-cards/${slug}.json`,'utf8'));
const spec=[
 [4,'action',3,'После каждого приставного шага остановиться и проверить положение обеих ног.'],
 [4,'conditions',1,'Заднюю ногу держать на носке с согнутым коленом и разворотом стопы примерно на 45 градусов.'],
 [4,'limitations',2,'Не растягивать прямоугольную базу до потери пружины; её ширина остаётся близкой к плечам.'],
 [5,'action',0,'Сначала собрать ноги в центре, затем раскрыть стойку вперёд или назад любой ногой.'],
 [5,'conditions',1,'При смене опоры одна стопа переходит с пятки на носок, а другая — с носка на пятку.'],
 [5,'problem',2,'Контролировать заднюю ногу и избегать чрезмерного удлинения стойки во время шаффла.'],
 [19,'action',1,'Ниндзя входит в размеченный квадрат; более глубокий вход даёт больше условных очков.'],
 [19,'conditions',2,'Засчитывать вход только после успешного выхода без попадания по ноге.'],
 [19,'limitations',0,'Самурай атакует тимбарой из условных ножен ниже колена без силового удара.']
];
for(const [i,field,thesis,text]of spec)data.cards.find(c=>c.chapterIndex===i)[field]={text,evidence:report.chapters[i].theses[thesis]};
validateCards(report,data);
const raw=JSON.stringify(data,null,2)+'\n';
mkdirSync('.codex/search-cards',{recursive:true});
writeFileSync('.codex/search-cards/conditions-candidate.json',raw);
console.log(JSON.stringify({ok:true,chapters:3,addedFields:9,sha256:createHash('sha256').update(raw).digest('hex')}));

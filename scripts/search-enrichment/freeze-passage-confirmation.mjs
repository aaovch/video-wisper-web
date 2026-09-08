import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash} from './core.mjs';
const sword=s=>'soedinenie-dlinnyi-mech-lager-noname-'+s;
const questions=[
 ['single','Противник положил меч на плечо после неудачных соединений. Как заставить его снова выставить оружие?',[[sword('4'),9]]],
 ['single','В коротком входе на меня давят клинком. Чем начинать перенос: руками или поворотом корпуса?',[[sword('3'),6]]],
 ['single','При разведении резинки над головой меня дёргает всем корпусом. Как изменить сопротивление или хват?', [['kinezio-trenirovka-5-plechevoy-poyas',12]]],
 ['single','От чего выбирать метод силовой подготовки, если одинаковый прирост силы дают разные механизмы?', [['tokarev-silovaya-ofp-2',24]]],
 ['single','После широкого батмана моё острие тоже улетает в сторону. Чем заменить замах?', [['avstriyskaya-sablya-trenirovka-6-batmany-vybor',4]]],
 ['single','Чужая гибкая сабля отгибается из захвата и всё равно меня достаёт. Какой приём надёжнее?', [['sablya-a-3',2]]],
 ['multi','Как вернуть спрятанный на плече меч на линию и что делать затем при давлении в коротком соединении?',[[sword('4'),9],[sword('3'),6]]],
 ['multi','Какая подготовка заставляет чужой клинок вернуться с плеча и чем отличается продолжение по открытой линии от переноса под давлением?',[[sword('4'),9],[sword('3'),6]]],
 ['unsupported','Сколько очков я заработал батманом на прошлой неделе?', [['avstriyskaya-sablya-trenirovka-6-batmany-vybor',4]]]
];
const data={version:1,protocol:{author:'Codex',note:'New wording after candidate fixed; source-aware and same-author, not independent holdout. Two compound paraphrases share the disclosed theme. No source or card edits.'},cases:questions.map(([kind,query,refs],i)=>({id:`passage-confirm-${i+1}`,query,kind,split:'holdout',coverage:kind,scopes:kind==='multi'?['collection','archive']:['report','collection','archive'],judgments:refs.map(([slug,index])=>{const report=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));return {reportSlug:slug,chapterIndex:index,grade:kind==='unsupported'?1:3,evidence:report.chapters[index].summary,sourceHash:sourceHash(sourceFor(report,index))};})}))};
const raw=JSON.stringify(data,null,2)+'\n';
writeFileSync('scripts/search-enrichment/passage-confirmation.json',raw);
writeFileSync('scripts/search-enrichment/passage-confirmation.sha256',createHash('sha256').update(raw).digest('hex')+'\n');

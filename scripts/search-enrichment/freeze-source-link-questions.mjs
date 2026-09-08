import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const raw=readFileSync('src/lib/data/search-source-links.json','utf8'),graph=JSON.parse(raw);
const queries=[
 'Как контролировать положение ног после приставного шага и при смене ведущей ноги?',
 'Какие разные продолжения с контактом показаны при проигрыше соединения и при давлении защиты на винден?',
 'Почему новичку нужен более медленный темп партнёра, когда он учится выбирать подготовленное решение по сигналу?',
 'Зачем партнёру доводить атаку в батманном упражнении и в работе монитора, даже если ученик не защищается?'
];
const data={protocol:'Source-aware same-author confirmation, authored after freezing the link graph; not independent holdout.',graphHash:createHash('sha256').update(raw).digest('hex'),cases:graph.links.map((link,i)=>({id:`source-link-confirm-${i+1}`,kind:'multi',query:queries[i],scopes:i===0?['report','collection','archive']:['collection','archive'],judgments:link.sources.map(s=>({...s,grade:3}))}))};
writeFileSync('scripts/search-enrichment/source-link-questions.json',JSON.stringify(data,null,2)+'\n');

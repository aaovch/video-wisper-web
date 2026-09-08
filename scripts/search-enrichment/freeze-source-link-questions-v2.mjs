import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const raw=readFileSync('src/lib/data/search-source-links.json','utf8'),graph=JSON.parse(raw);
const queries=[
 'Какими разными проверками убедиться, что из входа ногами можно отступить, а рука с баклером держит давление?',
 'Как усложняют задание с двумя мячами и работу монитора, когда простой вариант стал слишком лёгким?',
 'Как отличить поднятую заранее защиту ученика от ошибки партнёра, который остановил удар и создал ложный успех?',
 'Как уменьшить сложность обучения: ограничить варианты угрозы и оставить один сигнал ноги для запуска рук?',
 'Как соединить выбор заученного действия по сигналу с распознаванием ситуации и доведением угрозы до конца?',
 'Когда нужно выбирать батман вместо финта и как не потерять открывшуюся линию широким движением?'
];
const data={protocol:'Same-author source-aware confirmation after freezing v2; topic questions are new wording, not independent holdout.',graphHash:createHash('sha256').update(raw).digest('hex'),cases:graph.links.slice(4).map((link,i)=>({id:`source-link-v2-${i+1}`,kind:'multi',query:queries[i],scopes:link.sources[0].reportSlug===link.sources[1].reportSlug?['report','collection','archive']:['collection','archive'],sharedCollectionsOnly:true,judgments:link.sources.map(s=>({...s,grade:3}))}))};
writeFileSync('scripts/search-enrichment/source-link-questions-v2.json',JSON.stringify(data,null,2)+'\n');

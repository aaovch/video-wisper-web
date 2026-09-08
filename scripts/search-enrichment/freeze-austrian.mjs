import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash} from './core.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const slugs=['avstriyskaya-sablya-obratnoe-lezvie','avstriyskaya-sablya-trenirovka-6-batmany-vybor'];
const questions=[
 [0,4,'При ударе снизу работает вся рука вместо пальцев. Как это исправляют в парах?'],
 [0,7,'Опускаю саблю вниз, а нижний удар всё равно проходит. Что неверно в защите?'],
 [0,10,'Как рубящим действием пройти обычную четвёрку до столкновения клинков?'],
 [0,14,'После защиты стало тесно для обычного замаха. Как отвечать и когда такой ответ не годится?'],
 [0,17,'Как разучить ногами выход в сторону, чтобы наступающий не загнал в клинч?'],
 [0,20,'Была ли на занятии про обратное лезвие полноценная отработка батманов?'],
 [1,2,'Где должна быть точка сбива, чтобы не промахнуться у острия и не упереться в гарду?'],
 [1,4,'Сбиваю чужую саблю, но своё острие тоже улетает. Как сохранить возможность сразу атаковать?'],
 [1,8,'Как после угрозы кисти провести укол мимо появившейся защиты?'],
 [1,10,'Можно ли войти через первую защиту мягким контактом, без удара по оружию?'],
 [1,13,'Почему финт не обманывает, если всё время работать быстро?'],
 [1,16,'Как по предъявленному положению сабли решить, делать показ или сбивать оружие?']
];
const registry={version:1,protocol:{author:'Codex',note:'Questions written after the candidate was fixed; same author, source-aware evaluation, not independent human gold. No tuning after disclosure.',candidateHashes:Object.fromEntries(slugs.map(s=>[s,hash(readFileSync(`.codex/search-cards/${s}.candidate.json`))]))},cases:questions.map(([s,i,query],n)=>{
 const report=JSON.parse(readFileSync(`src/lib/data/reports/${slugs[s]}.json`,'utf8'));
 return {id:`austrian-${n+1}`,query,kind:'single',split:'holdout',coverage:'new-card-report',scopes:['report','collection','archive'],judgments:[{reportSlug:slugs[s],chapterIndex:i,grade:3,evidence:report.chapters[i].summary,sourceHash:sourceHash(sourceFor(report,i))}]};
})};
const raw=JSON.stringify(registry,null,2)+'\n',path='scripts/search-enrichment/austrian-registry.json';
if(existsSync(path)&&readFileSync(path,'utf8')!==raw)throw Error('Frozen registry changed');
writeFileSync(path,raw);writeFileSync(path.replace('.json','.sha256'),hash(raw)+'\n');console.log({questions:questions.length,hash:hash(raw)});

import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash} from './core.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const slug='mech-i-bakler-mikrotsikl-1-osnovy',r=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
const spec=[
 [4,'На дорожке стойка постепенно расползается. Что проверять после каждого перемещения?'],
 [4,'Как поставить заднюю стопу и колено, чтобы сохранить пружинящую опору с баклером?'],
 [5,'Какая последовательность ног нужна, чтобы раскрыть шаффл в любую сторону?'],
 [5,'Как перераспределять пятку и носок при смене передней ноги в шаффле?'],
 [19,'В игре удалось зайти глубоко, но на выходе меня задели по ноге. Засчитывается попытка?'],
 [19,'Из какого положения и в какую зону действует самурай в парной игре?'],
 [3,'Как усложнить броски двух мячей, когда одновременная ловля уже получается?'],
 [7,'Как проверить давление на щит, чтобы не складывалась кисть?'],
 [14,'Где держать левую руку, пока после отхода меч готовится к верхнему уколу?']
];
const d={version:1,protocol:{author:'Codex',reason:'Nine new formulations after fixing the condition candidate, six treated topics and three unchanged chapter controls. Same author, known source topics; not independent human gold.',candidateSha256:hash(readFileSync('.codex/search-cards/conditions-candidate.json'))},cases:spec.map(([i,query],n)=>({id:`conditions-${n+1}`,kind:'single',split:'holdout',coverage:n<6?'treated':'control',query,scopes:['report','collection','archive'],judgments:[{reportSlug:slug,chapterIndex:i,grade:3,evidence:r.chapters[i].summary,sourceHash:sourceHash(sourceFor(r,i))}]}))};
const raw=JSON.stringify(d,null,2)+'\n',path='scripts/search-enrichment/conditions-registry.json';
if(existsSync(path)&&readFileSync(path,'utf8')!==raw)throw Error('Frozen registry changed');
writeFileSync(path,raw);writeFileSync(path.replace('.json','.sha256'),hash(raw)+'\n');console.log({questions:spec.length,hash:hash(raw)});

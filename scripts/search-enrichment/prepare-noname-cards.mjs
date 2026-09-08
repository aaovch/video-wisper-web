import {readFileSync,writeFileSync} from 'node:fs';
import {runCardsCommand} from './cards-cli.mjs';
import {validateCards} from './cards.mjs';
const specs=JSON.parse(readFileSync(new URL('./noname-card-spec.json',import.meta.url),'utf8'));
for(const [slug,texts]of Object.entries(specs)){
 runCardsCommand(process.cwd(),['prepare',slug,'--dry-run']);
 const prepared=runCardsCommand(process.cwd(),['prepare',slug]);
 const pack=JSON.parse(readFileSync(prepared.artifacts[0].path,'utf8'));
 const report=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
 if(texts.length!==pack.chapters.length)throw Error(`Incomplete source review: ${slug}`);
 const candidate={version:1,reportSlug:slug,promptVersion:pack.promptVersion,dictionarySha256:pack.dictionarySha256,generator:'Codex; source-reviewed NoName sword/sabre rollout; 2026-09-08',cards:texts.map((text,i)=>({chapterIndex:i,sourceHash:pack.chapters[i].sourceHash,termIds:[],situation:{text,evidence:pack.chapters[i].chapter.summary}}))};
 validateCards(report,candidate);
 const path=`.codex/search-cards/${slug}.candidate.json`;writeFileSync(path,JSON.stringify(candidate,null,2)+'\n');
 const result=runCardsCommand(process.cwd(),['import',slug,path,'--dry-run']);
 if(process.argv.includes('--import'))runCardsCommand(process.cwd(),['import',slug,path]);
 console.log(JSON.stringify({slug,coverage:result.coverage,imported:process.argv.includes('--import')}));
}

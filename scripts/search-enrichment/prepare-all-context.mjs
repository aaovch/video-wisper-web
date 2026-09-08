import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {fencingCoverage} from './coverage.mjs';
import {createContextCards} from './extractive-context.mjs';
import {validateCards} from './cards.mjs';
import {runCardsCommand} from './cards-cli.mjs';
const apply=process.argv.includes('--apply'),root=process.cwd(),dir=join(root,'.codex/search-context');
const manifest=[];
for(const entry of fencingCoverage(root).reports){
 const slug=entry.slug,target=join(root,'src/lib/data/search-cards',slug+'.json');
 if(existsSync(target))continue; // Never replace reviewed cards or a stale candidate.
 const report=JSON.parse(readFileSync(join(root,'src/lib/data/reports',slug+'.json'),'utf8'));
 const data=createContextCards(report);
 validateCards(report,data);
 manifest.push({slug,chapters:data.cards.length,sourceMode:data.sourceMode});
 if(apply){
  mkdirSync(dir,{recursive:true});const candidate=join(dir,slug+'.candidate.json');writeFileSync(candidate,JSON.stringify(data,null,2)+'\n');
  runCardsCommand(root,['import',slug,candidate,'--dry-run']);runCardsCommand(root,['import',slug,candidate]);
 }
}
if(apply&&manifest.length){
 const path=join(dir,'manifest.json');
 const previous=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):[];
 writeFileSync(path,JSON.stringify([...new Map([...previous,...manifest].map(r=>[r.slug,r])).values()],null,2)+'\n');
}
console.log(JSON.stringify({ok:true,dryRun:!apply,reports:manifest.length,chapters:manifest.reduce((s,r)=>s+r.chapters,0),manifest},null,2));

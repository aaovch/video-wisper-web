// Materialize authored, reviewed source references; no model or paraphrasing here.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {sourceFor,sourceHash} from './core.mjs';
import {CARD_FIELDS,CARD_PROMPT_VERSION,validateCards} from './cards.mjs';
import {dictionaryProvenance} from './dictionary.mjs';
const dryRun=process.argv.includes('--dry-run');
const specPath=process.argv.find(a=>a.startsWith('--spec='))?.slice(7)??'scripts/search-enrichment/pilot-card-spec.json';
const specs=JSON.parse(readFileSync(specPath,'utf8'));
for(const spec of specs){
 const r=JSON.parse(readFileSync(`src/lib/data/reports/${spec.slug}.json`,'utf8'));
 const data={version:1,reportSlug:spec.slug,promptVersion:CARD_PROMPT_VERSION,generator:'Codex; source-reviewed manual pilot',dictionarySha256:dictionaryProvenance.sourceSha256,
  cards:spec.cards.map(c=>({chapterIndex:c.i,sourceHash:sourceHash(sourceFor(r,c.i)),termIds:c.terms,
   ...Object.fromEntries(CARD_FIELDS.filter(f=>c[f]).map(f=>[f,{text:c[f][1],evidence:c[f][0]===-1?r.chapters[c.i].summary:r.chapters[c.i].theses[c[f][0]]}]))}))};
 validateCards(r,data);
 if(!dryRun){
  mkdirSync('.codex/search-cards',{recursive:true});const candidate=`.codex/search-cards/${spec.slug}.candidate.json`;
  writeFileSync(candidate,JSON.stringify(data,null,2)+'\n');
  for(const flags of [['--dry-run'],[]]){
   const result=spawnSync(process.execPath,['scripts/search-enrichment/cards-cli.mjs','import',spec.slug,candidate,...flags],{encoding:'utf8'});
   const output=JSON.parse(result.stdout);if(result.status!==0||!output.ok)throw Error(result.stdout);
  }
 }
}
console.log(JSON.stringify({ok:true,dryRun,reports:specs.length,cards:specs.reduce((n,s)=>n+s.cards.length,0)}));

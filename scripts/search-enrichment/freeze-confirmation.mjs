import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash} from './core.mjs';
const specs=JSON.parse(readFileSync('scripts/search-enrichment/pilot-confirmation-spec.json','utf8'));
const judge=(slug,i)=>{const r=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));return {reportSlug:slug,chapterIndex:i,grade:3,title:r.chapters[i].title,evidence:r.chapters[i].summary,sourceHash:sourceHash(sourceFor(r,i))};};
const cases=specs.flatMap(([slug,ci,cq,ui,uq],i)=>[
 {id:`confirmation-${i+1}-covered`,kind:'single',split:'holdout',coverage:'covered',query:cq,scopes:['report','collection','archive'],judgments:[judge(slug,ci)]},
 {id:`confirmation-${i+1}-control`,kind:'single',split:'holdout',coverage:'control',query:uq,scopes:['report','collection','archive'],judgments:[judge(slug,ui)]}
]);
// Hold the candidate files fixed across this additional, prospectively balanced check.
const fingerprint=createHash('sha256');
for(const [slug]of specs)fingerprint.update(readFileSync(`src/lib/data/search-cards/${slug}.json`));
const d={version:1,protocol:{author:'Codex',reason:'The first holdout concentrated on uncovered chapters. This additional set was authored after that result, before its own evaluation. It does not replace or erase the first holdout.',
 limitations:'Same author; mostly alternate formulations of source topics, not new independent topics. No candidate card or ranking changes after development.',cardFingerprint:fingerprint.digest('hex')},cases};
const raw=JSON.stringify(d,null,2)+'\n',hash=createHash('sha256').update(raw).digest('hex');
if(!process.argv.includes('--dry-run')){
 writeFileSync('scripts/search-enrichment/pilot-confirmation.json',raw);
 writeFileSync('scripts/search-enrichment/pilot-confirmation.sha256',hash+'\n');
}
console.log(JSON.stringify({ok:true,dryRun:process.argv.includes('--dry-run'),questions:cases.length,covered:8,control:8,hash}));

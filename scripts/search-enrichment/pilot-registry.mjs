import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFor,sourceHash} from './core.mjs';
const spec=JSON.parse(readFileSync('scripts/search-enrichment/pilot-question-spec.json','utf8'));
const judgment=(slug,i,grade)=>{
 const report=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
 return {reportSlug:slug,chapterIndex:i,grade,title:report.chapters[i].title,evidence:report.chapters[i].summary,sourceHash:sourceHash(sourceFor(report,i))};
};
const cases=[];
spec.single.forEach(([slug,i,query],n)=>cases.push({id:`p-single-${n+1}`,kind:'single',split:n%5>=3?'holdout':'development',query,
 scopes:['report','collection','archive'],judgments:[judgment(slug,i,3)]}));
spec.multi.forEach(([a,ai,b,bi,query],n)=>cases.push({id:`p-multi-${n+1}`,kind:'multi',split:n>=6?'holdout':'development',query,
 scopes:['archive'],judgments:[judgment(a,ai,3),judgment(b,bi,3)]}));
spec.unsupported.forEach(([slug,i,query,reason],n)=>cases.push({id:`p-unsupported-${n+1}`,kind:'unsupported',split:n>=10?'holdout':'development',query,
 scopes:['report'],missingInformation:reason,judgments:[judgment(slug,i,1)]}));
const data={version:1,protocol:{author:'Codex',generationOrder:'Cards authored and materialized before questions; questions frozen before ranking evaluation. Same author, not independent human gold.',
 grades:{3:'Known direct support; multi tasks require all listed sources',2:'Useful partial answer',1:'Related context that cannot answer the requested personal fact',0:'Judged irrelevant'},
 unjudged:'Unjudged is not irrelevant; metrics are based on known support only.',
 unsupported:'Personal facts/observations not supplied by the user. Related material is explicitly allowed, but is not a complete answer.',
 holdout:'Do not use the holdout split for tuning. Once evaluated it is considered disclosed.'},cases};
if(cases.length!==60||cases.filter(c=>c.split==='holdout').length!==20)throw Error('Invalid split');
const serialized=JSON.stringify(data,null,2)+'\n';
const sha256=createHash('sha256').update(serialized).digest('hex');
if(!process.argv.includes('--dry-run')){
 writeFileSync('scripts/search-enrichment/pilot-registry.json',serialized);
 writeFileSync('scripts/search-enrichment/pilot-registry.sha256',sha256+'\n');
}
console.log(JSON.stringify({ok:true,dryRun:process.argv.includes('--dry-run'),families:60,development:40,holdout:20,sha256}));

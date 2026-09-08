import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateCards} from './cards.mjs';
import {sourceFor,sourceHash} from './core.mjs';
import {dictionaryProvenance} from './dictionary.mjs';

export function auditCards(root,slug){
 const result={slug,status:'invalid',covered:0,total:0,missing:[],stale:[],errors:[]};
 try{
  if(!/^[a-z0-9][a-z0-9_-]*$/.test(slug))throw Error('Invalid report slug');
  const report=JSON.parse(readFileSync(join(root,'src/lib/data/reports',slug+'.json'),'utf8'));
  if(report.slug!==slug||!Array.isArray(report.chapters))throw Error('Invalid report');
  if(report.search_cards_required!==undefined&&typeof report.search_cards_required!=='boolean')throw Error('Invalid search_cards_required');
  result.required=report.search_cards_required===true;
  result.total=report.chapters.length;
  const path=join(root,'src/lib/data/search-cards',slug+'.json');
  if(!existsSync(path)){
   result.status='missing';result.missing=report.chapters.map((_,i)=>i);
  }else{
   const data=JSON.parse(readFileSync(path,'utf8'));
   result.sourceMode=data.sourceMode??'situational-rewrite';
   const present=new Set();
   for(const c of Array.isArray(data.cards)?data.cards:[]){
    if(!Number.isInteger(c?.chapterIndex)||!report.chapters[c.chapterIndex])continue;
    present.add(c.chapterIndex);
    if(c.sourceHash!==sourceHash(sourceFor(report,c.chapterIndex)))result.stale.push(c.chapterIndex);
   }
   result.missing=report.chapters.flatMap((_,i)=>present.has(i)?[]:[i]);
   result.dictionaryChanged=data.dictionarySha256!==dictionaryProvenance.sourceSha256;
   if(result.dictionaryChanged)result.stale=[...present];
   result.stale=[...new Set(result.stale)].sort((a,b)=>a-b);
   try{validateCards(report,data);result.status=result.missing.length?'partial':'complete';result.covered=present.size;}
   catch(error){
    result.errors.push(error.message);
    result.status=error.message.startsWith('Stale card ')?'stale':'invalid';
    // Coverage is trusted only after the complete validator has passed.
   }
  }
 }catch(error){result.errors.push(error.message);}
 if(result.status!=='complete')result.recovery={
  chapterIndices:result.status==='invalid'?Array.from({length:result.total},(_,i)=>i):[...new Set([...result.missing,...result.stale])].sort((a,b)=>a-b),
  prepareArgs:['scripts/search-enrichment/cards-cli.mjs',result.sourceMode==='extractive-context'?'prepare-context':'prepare',slug,'--dry-run'],
  instruction:'Prepare the source pack, review the listed chapters, regenerate supported fields, then import the complete candidate with --dry-run before writing. Keep valid unchanged cards. Never repair provenance by replacing hashes alone.'
 };
 return result;
}
export function auditSearchCards(root,target='--all',requireComplete=false){
 const dir=join(root,'src/lib/data/reports');
 const slugs=target==='--all'?[...new Set([
  ...readdirSync(dir).filter(n=>n.endsWith('.json')).map(n=>n.slice(0,-5)),
  ...(existsSync(join(root,'src/lib/data/search-cards'))?readdirSync(join(root,'src/lib/data/search-cards')).filter(n=>n.endsWith('.json')).map(n=>n.slice(0,-5)):[])
 ])].sort():[target];
 const reports=slugs.map(s=>auditCards(root,s));
 const ok=reports.every(r=>requireComplete||r.required?r.status==='complete':!['stale','invalid'].includes(r.status));
 return {ok,requireComplete,summary:Object.fromEntries(['complete','partial','missing','stale','invalid'].map(s=>[s,reports.filter(r=>r.status===s).length])),reports,artifacts:[],
  ...(ok?{}:{error:{code:'SEARCH_CARD_AUDIT_FAILED',message:'Search cards need source review; see per-report recovery.'}})};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2),target=args.find(a=>!a.startsWith('--'))??'--all';
  if(args.some(a=>a.startsWith('--')&&!['--all','--require-complete','--summary'].includes(a)))throw Error('Unknown audit option');
  const result=auditSearchCards(resolve(dirname(fileURLToPath(import.meta.url)),'../..'),target,args.includes('--require-complete'));
  if(args.includes('--summary')){
   const total=result.reports.length;
   result.reports=result.reports.filter(r=>result.requireComplete||r.required?r.status!=='complete':['partial','stale','invalid'].includes(r.status));
   result.detailsOmitted=total-result.reports.length;
  }
  console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
 }catch(error){console.log(JSON.stringify({ok:false,error:{code:'SEARCH_CARD_AUDIT_FAILED',message:error.message},artifacts:[]}));process.exitCode=1;}
}

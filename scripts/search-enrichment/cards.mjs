import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {sourceFor,sourceHash,sourceText} from './core.mjs';
import {dictionaryProvenance} from './dictionary.mjs';
import {extractiveContext,CONTEXT_PROMPT_VERSION} from './extractive-context.mjs';

export const CARD_PROMPT_VERSION='hema-situation-card-v1';
export const CARD_FIELDS=['context','situation','problem','action','conditions','limitations'];
const assert=(ok,message)=>{if(!ok)throw Error(message);};
export function validateCards(report,data){
 assert(data?.version===1&&data.reportSlug===report.slug,'Invalid card version/report');
 assert(data.sourceMode===undefined||data.sourceMode==='extractive-context','Invalid card source mode');
 assert(data.promptVersion===(data.sourceMode==='extractive-context'?CONTEXT_PROMPT_VERSION:CARD_PROMPT_VERSION),'Invalid card prompt version');
 assert(typeof data.generator==='string'&&data.generator.trim(),'Missing card generator');
 assert(data.dictionarySha256===dictionaryProvenance.sourceSha256,'Stale card dictionary');
 assert(Array.isArray(data.cards)&&data.cards.length>0,'Missing cards');
 const seen=new Set();
 for(const c of data.cards){
  assert(Number.isInteger(c.chapterIndex)&&report.chapters[c.chapterIndex]&&!seen.has(c.chapterIndex),'Invalid/duplicate card chapter');
  seen.add(c.chapterIndex);
  const source=sourceFor(report,c.chapterIndex);
  assert(c.sourceHash===sourceHash(source),`Stale card source: chapter ${c.chapterIndex}`);
  let count=0;
  for(const field of CARD_FIELDS){
   if(c[field]===undefined)continue;
   count++;
   assert(typeof c[field].text==='string'&&c[field].text.trim()&&c[field].text.length<=400,'Invalid card text');
   assert(typeof c[field].evidence==='string'&&c[field].evidence.trim().length>=16&&sourceText(source).includes(c[field].evidence),'Ungrounded card evidence');
  }
  assert(count>0,'Empty card');
  if(data.sourceMode==='extractive-context'){
   const expected=extractiveContext(report,c.chapterIndex);
   assert(count===1&&c.context?.text===expected.text&&c.context?.evidence===expected.evidence,'Nonliteral extractive context');
   assert(c.termIds?.length===0,'Extractive context cannot infer terms');
  }
  assert(Array.isArray(c.termIds),'Missing term IDs');
  const dictionary=JSON.parse(readFileSync(new URL('../../src/lib/data/hema-search-dictionary.json',import.meta.url),'utf8'));
  assert(c.termIds.every(id=>dictionary.entries.some(e=>e.id===id)),'Unknown dictionary ID');
 }
 return data;
}
export const cardText=card=>CARD_FIELDS.flatMap(f=>card[f]?[card[f].text]:[]).join(' ');
export function cardCoverage(report,data){
 if(!data)return {status:'missing',covered:0,total:report.chapters.length,missing:report.chapters.map((_,i)=>i)};
 validateCards(report,data);
 const covered=new Set(data.cards.map(c=>c.chapterIndex));
 const missing=report.chapters.flatMap((_,i)=>covered.has(i)?[]:[i]);
 return {status:missing.length?'partial':'complete',covered:covered.size,total:report.chapters.length,missing};
}
export function readCards(root,report){
 const path=join(root,'src/lib/data/search-cards',`${report.slug}.json`);
 const data=existsSync(path)?validateCards(report,JSON.parse(readFileSync(path,'utf8'))):null;
 if(report.search_cards_required!==undefined&&typeof report.search_cards_required!=='boolean')throw Error('Invalid search_cards_required');
 if(report.search_cards_required&&cardCoverage(report,data).status!=='complete')throw Error(`Required search cards incomplete: ${report.slug}`);
 return data;
}

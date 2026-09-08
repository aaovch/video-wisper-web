// Literal parent/chapter context, not a generated paraphrase or inferred technique.
import {sourceFor,sourceHash} from './core.mjs';
import {dictionaryProvenance} from './dictionary.mjs';
export const CONTEXT_PROMPT_VERSION='hema-source-context-v1';
export function extractiveContext(report,index){
 const chapter=report.chapters[index];
 const text=`${report.title}\n${chapter.title}`;
 if(text.length>400)throw Error(`Context too long: ${report.slug}/${index}`);
 const evidence=[chapter.summary,...(chapter.theses??[]),chapter.title].find(s=>typeof s==='string'&&s.trim().length>=16);
 if(!evidence)throw Error(`Missing context evidence: ${report.slug}/${index}`);
 return {text,evidence};
}
export function createContextCards(report){
 return {version:1,sourceMode:'extractive-context',reportSlug:report.slug,promptVersion:CONTEXT_PROMPT_VERSION,dictionarySha256:dictionaryProvenance.sourceSha256,generator:'extractive-context-v1; literal existing report and chapter titles; no new LLM call',cards:report.chapters.map((_,i)=>({chapterIndex:i,sourceHash:sourceHash(sourceFor(report,i)),termIds:[],context:extractiveContext(report,i)}))};
}

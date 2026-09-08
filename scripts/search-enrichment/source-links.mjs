import {readFileSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceFor,sourceHash,sourceText} from './core.mjs';
export function validateSourceLinks(data,readReport){
 const check=(ok,message)=>{if(!ok)throw Error(`Source links: ${message}`);};
 check(data?.version===1&&Array.isArray(data.links),'invalid schema');
 const seen=new Set();
 for(const link of data.links){
  check(typeof link.id==='string'&&!seen.has(link.id),'duplicate/missing ID');seen.add(link.id);
  check(typeof link.explanation==='string'&&link.explanation.length>=20&&link.explanation.length<=400,'missing relationship explanation');
  check(typeof link.generator==='string'&&link.generator.trim(),'missing provenance');
  check(Array.isArray(link.sources)&&link.sources.length===2,'expected two reviewed sources');
  const refs=new Set();
  for(const ref of link.sources){
   check(/^[a-z0-9][a-z0-9_-]*$/.test(ref.reportSlug),'invalid slug');
   const report=readReport(ref.reportSlug),chapter=report.chapters[ref.chapterIndex];
   check(Number.isInteger(ref.chapterIndex)&&chapter,'missing chapter');
   const key=`${ref.reportSlug}:${ref.chapterIndex}`;check(!refs.has(key),'duplicate source');refs.add(key);
   check(ref.sourceHash===sourceHash(sourceFor(report,ref.chapterIndex)),`stale ${key}`);
   check(ref.title===chapter.title&&ref.reportTitle===report.title&&ref.start===chapter.start,`stale label/time ${key}`);
   check(typeof ref.role==='string'&&ref.role.length>=8&&ref.role.length<=150,'missing source role');
   check(typeof ref.evidence==='string'&&ref.evidence.length>=16&&sourceText(sourceFor(report,ref.chapterIndex)).includes(ref.evidence),`ungrounded ${key}`);
  }
 }
 return data;
}
export function auditSourceLinks(root){
 const path=join(root,'src/lib/data/search-source-links.json');
 if(!existsSync(path))return;
 return validateSourceLinks(JSON.parse(readFileSync(path,'utf8')),slug=>JSON.parse(readFileSync(join(root,'src/lib/data/reports',slug+'.json'),'utf8')));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const data=auditSourceLinks(resolve(dirname(fileURLToPath(import.meta.url)),'../..'));console.log(JSON.stringify({ok:true,links:data?.links.length??0}));}
 catch(error){console.log(JSON.stringify({ok:false,error:{code:'SEARCH_SOURCE_LINK_INVALID',message:error.message}}));process.exitCode=1;}
}

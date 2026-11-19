import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export const reportFormat=JSON.parse(readFileSync(new URL('./report-format.json',import.meta.url),'utf8'));
export const reportStyleInstructions=reportFormat.rules.join('\n');
export const materialPolicy=reportFormat.material_policy;
export const fidelityChecks=materialPolicy.checks.map(check=>check.id);
export const materialPolicyIdentity={version:materialPolicy.version,sha256:createHash('sha256').update(JSON.stringify({report_format:reportFormat.version,limits:reportFormat.limits,limitationTitle:reportFormat.limitationTitle,rules:reportFormat.rules,material_policy:materialPolicy})).digest('hex')};
export function materialInstructions(stage) {
  if(!['prepare','review','reader','revision'].includes(stage))throw Error('Unknown material policy stage: '+stage);
  return [`Material policy ${materialPolicyIdentity.version}; sha256=${materialPolicyIdentity.sha256}`,
    reportStyleInstructions,...materialPolicy.common,...materialPolicy.checks.map(check=>`${check.id}: ${check.rule}`),...materialPolicy[stage]].join('\n');
}
const fail=path=>{throw Error('Report format '+reportFormat.version+': '+path);};
const text=(v,path,max=reportFormat.limits.text)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(path);};
const list=(v,path,max=1000)=>{if(!Array.isArray(v)||v.length>max)fail(path);return v;};
export function validateReportFormat(r) {
  if(!r||typeof r!=='object'||'long_summary' in r)fail('report/long_summary');
  text(r.title,'title',reportFormat.limits.title);text(r.subtitle,'subtitle',reportFormat.limits.subtitle);
  list(r.tags,'tags',reportFormat.limits.tags).forEach(t=>text(t,'tag',reportFormat.limits.tag));
  if(!list(r.overview_theses,'overview_theses',reportFormat.limits.overview).length)fail('empty overview');
  r.overview_theses.forEach(t=>text(t,'overview'));
  let previous=-1;
  if(!list(r.chapters,'chapters',150).length)fail('empty chapters');
  for(const c of r.chapters){if(!Number.isFinite(c.start)||c.start<0||c.start<=previous)fail('chapter timestamp');previous=c.start;text(c.anchor,'anchor');text(c.title,'chapter title');text(c.summary,'chapter summary');list(c.theses,'theses',100).forEach(t=>text(t,'thesis'));}
  const m=r.materials;if(!m||typeof m!=='object')fail('materials');
  for(const n of list(m.notes,'notes',200)){text(n.title,'note title');if(!list(n.items,'note items',200).length)fail('empty note');n.items.forEach(t=>text(t,'note'));}
  for(const g of list(m.exercises,'exercises',200)){text(g.title,'exercise title');if(!list(g.items,'exercise items',200).length)fail('empty exercise');for(const x of g.items){text(x.text,'exercise');if(!Number.isFinite(x.start)||x.start<0)fail('exercise timestamp');}}
  for(const g of list(m.glossary,'glossary',200)){text(g.term,'term');text(g.definition,'definition');}
  return r;
}
export function validateReaderLimitation(value) {
  text(value,'limitation');
  if(/сегмент\S*\s*\d|диагностическ\S*\s+флаг|реестр\S*\s+термин|sha-?256|segment[_ -]?id/i.test(value))fail('limitation contains internal diagnostics');
  return value;
}
export function addReaderLimitations(report,limitations=[]) {
  if(!limitations.length)return report;
  const items=limitations.map(x=>{validateReaderLimitation(x.text);if(!Number.isFinite(x.start)||x.start<0)fail('limitation timestamp');const s=Math.floor(x.start);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')} — ${x.text}`;});
  return {...report,materials:{...report.materials,notes:[...report.materials.notes,{title:reportFormat.limitationTitle,items}]}};
}
export function editorialContent(d) {
  const p=d.presentation;
  const report={title:p.title.text,subtitle:p.subtitle.text,tags:p.tags.map(x=>x.text),overview_theses:d.overview.length ? [d.overview.map(x=>x.text).join(' ')] : [],
    chapters:d.chapters.map(c=>({start:c.start,anchor:c.anchor,title:c.title.text,summary:c.summary.text,theses:c.points.map(x=>x.text)})),
    materials:{notes:d.materials.notes.map(n=>({title:n.title.text,items:n.items.map(x=>x.text)})),
      exercises:d.materials.exercises.map(n=>({title:n.title.text,items:n.items.map(x=>({start:x.start,text:x.claims.map(c=>c.text).join(' ')}))})),
      glossary:d.materials.glossary.map(x=>({term:x.term.text,definition:x.definition.text}))}};
  return addReaderLimitations(report,(d.limitations??[]).map(x=>({start:d.segments?.[x.first]?.start,text:x.reader_text})));
}
// Local Python skill invokes the exact same validator/formatter used by the worker.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{if(process.argv[2]==='schema')console.log(JSON.stringify({...reportFormat,material_policy_identity:materialPolicyIdentity},null,2));else if(process.argv[2]==='instructions')console.log(materialInstructions(process.argv[3]));else if(process.argv[2]==='validate'){const input=JSON.parse(readFileSync(0,'utf8'));const r=addReaderLimitations(validateReportFormat(input.report),input.limitations);console.log(JSON.stringify({report:validateReportFormat(r),report_format:reportFormat.version,material_policy:materialPolicyIdentity}));}else throw Error('Use schema, instructions <prepare|review|reader|revision> or validate (JSON stdin)');}
  catch(e){console.error(e.message);process.exitCode=1;}
}

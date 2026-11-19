import {passedReview} from './result-ready.mjs';
import {editorialContent,validateReportFormat} from './report-format.mjs';
import {resolveReportGate} from '../../src/lib/data/report-access.js';
import {validateEditorial} from './editorial.mjs';
const list=v=>String(v??'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,8);
export function placementInput(data,collections,allowUnassigned=false) {
 const target=String(data.get('collection')??'');const [collection,section='']=target.split(':');
 const title=String(data.get('title')??'').trim().slice(0,250),newTitle=String(data.get('new_collection')??'').trim().slice(0,120);
 const authors=list(data.get('authors')),weapons=list(data.get('weapons'));
 if(data.get('new_access')==='key'&&collection!=='new')throw Error('Для этой коллекции выберите пароль записи.');
 if(collection==='new') {if(!newTitle)throw Error('Укажите название новой коллекции.');if(collections.some(c=>c.title.toLocaleLowerCase()===newTitle.toLocaleLowerCase()))throw Error('Коллекция с таким названием уже есть. Выберите её в списке.');}
 else if(target || !allowUnassigned) {const c=collections.find(c=>c.slug===collection&&!c.catalogHidden&&c.hema);if(!c)throw Error('Выберите коллекцию.');if(section!==''&&(!/^\d+$/.test(section)||!c.sections?.[Number(section)]))throw Error('Раздел коллекции не найден.');if(!authors.length&&c.facets?.authors?.length===1)authors.push(c.facets.authors[0]);}
 return {newAccess:data.get('new_access')==='report'?'report':collection==='new'&&data.get('new_access')==='key'?'key':'inherit',collection,section:section===''?null:Number(section),sectionTitle:section===''?'':collections.find(c=>c.slug===collection)?.sections?.[Number(section)]?.title??'',newTitle:collection==='new'?newTitle:'',title,authors,weapons};
}
export function makePublication(row,collections,reports=[]) {
 const p=row.placement;if(!p)throw Error('Перед публикацией выберите коллекцию.');
 const source=new URL(row.url),videoId=source.searchParams.get('v'),slug='video-'+videoId;
 if(reports.some(r=>r.video?.provider==='youtube'&&r.video.id===videoId))throw Error('Это видео уже есть в основном архиве.');
 if(p.collection==='new'&&collections.some(c=>c.title.toLocaleLowerCase()===p.newTitle.toLocaleLowerCase()))throw Error('Такая коллекция уже создана. Выберите её в списке.');
 const raw=row.draft;if(!passedReview(raw))throw Error('Сначала исправьте замечания проверки текста.');
 const d={...raw,...validateEditorial(raw,{segments:raw.segments,duration:raw.segments.at(-1).end},raw.flags)};
 const newCollection=p.collection==='new'?{slug:'collection-'+row.id.slice(0,16),title:p.newTitle,subtitle:'',hema:true,items:[],facets:{authors:p.authors,weapons:p.weapons}}:null;
 if(newCollection && p.newAccess==='key')newCollection.access={master:{id:'submission-collection-'+row.id,credentialVersion:1,passwordHint:'Введите пароль этой коллекции.'}};
 const collection=newCollection??collections.find(c=>c.slug===p.collection);
 if(!collection||collection.catalogHidden||!collection.hema)throw Error('Коллекция больше недоступна.');
 if(p.section!==null&&!collection.sections?.[p.section])throw Error('Раздел коллекции изменился. Выберите его заново.');
 if(p.sectionTitle&&collection.sections[p.section].title!==p.sectionTitle)throw Error('Раздел коллекции изменился. Выберите его заново.');
 const {report,transcript}=readerRecord(row,slug,d);
 const reportPass=p.newAccess==='report'?{id:'submission-report-'+row.id,credentialVersion:1,title:report.title,items:[slug],passwordHint:'Введите пароль этой записи.'}:null;
 return {version:1,...(reportPass?{reportPass}:{}),collection:collection.slug,section:p.section,sectionTitle:collection.sections?.[p.section]?.title??'',newCollection,facets:{authors:p.authors,weapons:p.weapons},report,transcript};
}
export function readerRecord(row,slug,d=row.draft) {
 const videoId=new URL(row.url).searchParams.get('v');
 const report={slug,title:row.placement?.title||d.title,subtitle:'',source_name:d.title,source_stem:videoId,source_url:row.url,note:'Подготовлено по распознанной речи OpenAI. Временные метки получены из API; неописанные движения не реконструируются.',duration:d.segments.at(-1).end,tags:[],overview_theses:d.overview.map(x=>x.text),video:{provider:'youtube',id:videoId},has_transcript:true,transcript_anchors_verified:true,chapters:d.chapters.map(c=>({start:c.start,title:c.title.text,summary:c.summary.text,theses:c.points.map(x=>x.text),anchor:d.segments[c.first].text})),materials:{notes:(d.materials?.notes??[]).map(n=>({title:n.title.text,items:n.items.map(x=>x.text)})),exercises:(d.materials?.exercises??[]).map(n=>({title:n.title.text,items:n.items.map(x=>({start:x.start,text:x.claims.map(c=>c.text).join(' ')}))})),glossary:(d.materials?.glossary??[]).map(x=>({term:x.term.text,definition:x.definition.text}))}};
 // Preserve uncertainty when promoting the private draft into the normal archive UI.
 if(!d.presentation && d.limitations?.length)report.materials.notes.push({title:'Ограничения разбора: что требует сверки с записью',items:d.limitations.map(x=>{const seconds=Math.floor(d.segments[x.first].start);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} — ${x.reason}`;})});
 if(d.presentation){Object.assign(report,editorialContent(d));if(d.final_result && d.limitations?.length) report.materials.notes.at(-1).title='Особенности записи';if(row.placement?.title)report.title=row.placement?.title;validateReportFormat(report);}
 const chapters=d.chapters.map(c=>({start:c.start,segments:d.segments.slice(c.first,c.last+1).map(({start,text})=>({start,text}))}));
 return {report,transcript:{transcript:d.segments.map(s=>s.text).join(' '),chapters}};
}
export function archiveSnapshot(store,baseCollections,baseReports) {
 const publications=store?.publications?.()??[];const collections=structuredClone(baseCollections),reports=[...baseReports],records=new Map();
 for(const p of publications)if(p.newCollection&&!collections.some(c=>c.slug===p.newCollection.slug))collections.push(structuredClone(p.newCollection));
 for(const p of publications) {
  const c=collections.find(c=>c.slug===p.collection);if(!c||reports.some(r=>r.slug===p.report.slug))continue;
  const r=p.report;c.items.push(r.slug);c.itemFacets??={};c.itemFacets[r.slug]=p.facets;
  if(p.reportPass){c.access??={};c.access.passes??=[];c.access.passes.push(p.reportPass);}
  if(c.sections?.length){let section=p.sectionTitle?c.sections.find(s=>s.title===p.sectionTitle):c.sections[p.section];if(!section){section=c.sections.find(s=>s.title==='Добавленные записи');if(!section){section={title:'Добавленные записи',items:[]};c.sections.push(section);}}section.items.push(r.slug);}
  for(const key of ['authors','weapons']){c.facets??={};for(const oldSlug of c.items){c.itemFacets[oldSlug]??={};if(c.itemFacets[oldSlug][key]===undefined)c.itemFacets[oldSlug][key]=[...(c.facets[key]??[])];}c.facets[key]=[...new Set([...(c.facets[key]??[]),...(p.facets[key]??[])])];}
  records.set(r.slug,p);reports.push({...r,chapters:undefined,materials:undefined,chapterCount:r.chapters.length});
 }
 const safeCollections=JSON.parse(JSON.stringify(collections,(key,value)=>key==='password'?undefined:value));
 const gates=new Map(reports.map(r=>[r.slug,resolveReportGate(r.slug,collections).map(x=>x.id)]));
 return {collections,reports,safeCollections,gates,records};
}
export function publicationDocs(p,transcript=false) {
 const r=p.report,docs=[];const add=(kind,text,title='',extra={})=>docs.push({id:`published:${r.slug}:${transcript?'t':'c'}:${docs.length}`,kind,reportSlug:r.slug,text,field_title:title,field_body:text,field_tags:(r.tags??[]).join(' '),...extra});
 if(!transcript){add('report',[r.title,...r.overview_theses].join(' '),r.title);for(const text of r.overview_theses)add('overview',text,r.title);}
 r.chapters.forEach((c,i)=>{const extra={chapterIndex:i,start:c.start};if(transcript){for(const s of transcriptWindows(p.transcript.chapters[i].segments))add('transcript',s.text,c.title,{...extra,start:s.start});}else {add('chapter',c.summary,c.title,{...extra,field_context:r.title+'\n'+c.title});for(const text of c.theses)add('thesis',text,c.title,extra);}});
 if(!transcript){for(const n of r.materials.notes)add('material',n.items.join(' '),n.title,{title:n.title,materialKind:'note'});for(const n of r.materials.exercises)for(const x of n.items)add('material',x.text,n.title,{title:n.title,materialKind:'exercise',start:x.start});for(const x of r.materials.glossary)add('material',x.definition,x.term,{title:x.term,materialKind:'glossary'});}
 return docs;
}
// Same phrase-window boundaries as the static archive index. Never cross chapters.
function transcriptWindows(segments) {
 const windows=[];let text='',start=0;
 const flush=()=>{if(text)windows.push({start,text});text='';};
 for(const s of segments){const value=s.text.trim();if(!value)continue;if(text&&(text.length+value.length+1>920||s.start-start>45))flush();if(!text)start=s.start;text+=(text?' ':'')+value;if(text.length>=620&&/[.!?…]$/.test(value))flush();}
 flush();return windows;
}

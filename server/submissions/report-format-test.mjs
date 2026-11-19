import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {reportFormat,validateReportFormat,editorialContent} from './report-format.mjs';
import {validateEditorial,validateOrRepairEditorial} from './editorial.mjs';
import {reviewAndImprove} from './editorial-workflow.mjs';
const transcript={duration:4,segments:[{id:0,start:0,end:1,text:'Закройте линию.'},{id:1,start:2.125,end:4,text:'Неразборчиво.'}]};
const claim={text:'Закройте линию.',citations:[{segment_id:0,quote:'Закройте линию.'}],rationale:'Synthetic source',checks:['actor_action','conditions_negation','modality_scope','terms_numbers','context_causality']};
const raw=()=>({format_version:'archive-skill-v2',presentation:{version:reportFormat.version,title:claim,subtitle:claim,tags:[claim]},overview:[claim],chapters:[{first:0,last:1,title:claim,summary:claim,points:[claim]}],materials:{notes:[],exercises:[],glossary:[]},source_coverage:[{first:0,last:0,disposition:'summarized',reason:'Topic'},{first:1,last:1,disposition:'uncertain',reason:'Unclear'}],terminology:[],limitations:[{first:1,last:1,reason:'Private segment-1 diagnostics',reader_text:'Последняя фраза неразборчива и не пересказана.'}]});
test('cloud projection and local CLI share the exact final Report contract and notices',()=>{
  const d=validateEditorial(raw(),transcript,[{segment_id:1}]);
  const cloud=validateReportFormat(editorialContent({...d,segments:transcript.segments}));
  assert.equal(cloud.subtitle,claim.text);assert.deepEqual(cloud.tags,[claim.text]);
  assert.deepEqual(cloud.materials.exercises,[]);
  assert.equal(cloud.materials.notes[0].items[0],'0:02 — Последняя фраза неразборчива и не пересказана.');
  assert.ok(!JSON.stringify(cloud).includes('Private'));
  const plain={...cloud,materials:{...cloud.materials,notes:[]}};
  const cli=spawnSync(process.execPath,[fileURLToPath(new URL('./report-format.mjs',import.meta.url)),'validate'],{input:JSON.stringify({report:plain,limitations:[{start:2.125,text:raw().limitations[0].reader_text}]}),encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);assert.deepEqual(JSON.parse(cli.stdout).report,cloud);
});
test('five supported overview sentences reach the reader as one complete paragraph',()=>{
  const draft=raw();draft.overview=Array.from({length:5},(_,i)=>({...claim,text:'Предложение '+(i+1)+'.'}));
  const valid=validateEditorial(draft,transcript,[{segment_id:1}]);
  assert.deepEqual(editorialContent({...valid,segments:transcript.segments}).overview_theses,[draft.overview.map(x=>x.text).join(' ')]);
});
test('new jobs cannot omit presentation or launder unsupported metadata into publication',async()=>{
  const valid=raw();await validateOrRepairEditorial(valid,transcript,[{segment_id:1}],()=>{throw Error('No repair expected');},true);
  for(const edit of [x=>delete x.presentation,x=>x.presentation.subtitle={...claim,text:''},x=>x.presentation.title={...claim,citations:[{segment_id:1,quote:'Неразборчиво.'}]},x=>x.limitations[0].reader_text='Сегменты 1–2 отмечены диагностическими флагами.',x=>x.overview=Array(6).fill(claim)]){
    const bad=raw();edit(bad);await assert.rejects(validateOrRepairEditorial(bad,transcript,[{segment_id:1}],async()=>bad,true));
  }
});
test('semantic repair cannot downgrade a new report to the legacy presentation',async()=>{
  const first=validateEditorial(raw(),transcript,[{segment_id:1}]);const legacy=raw();delete legacy.presentation;
  const result=await reviewAndImprove(first,transcript,[{segment_id:1}],async name=>({value:name.startsWith('semantic-repair')?legacy:name.startsWith('reader-audit')?{chapters:[{issues:[]}],exercises:[]}:{pass:false,issues:['Synthetic correction needed'],notes:''}}));
  assert.equal(result.review.pass,false);assert.equal(result.editorial.presentation.version,reportFormat.version);
});

test('an already identified uncertain interval gets a timestamped notice without model regeneration',async()=>{
  const draft=raw();
  draft.limitations=[];
  const checked=await validateOrRepairEditorial(draft,transcript,[{segment_id:1}],()=>assert.fail('unexpected model call'),true);
  assert.equal(checked.limitations.length,1);
  assert.equal(checked.limitations[0].first,1);
  assert.equal(checked.limitations[0].last,1);
  assert.match(editorialContent({...checked,segments:transcript.segments}).materials.notes[0].items[0],/^0:02/);
  assert.deepEqual(draft.limitations,[]);
});

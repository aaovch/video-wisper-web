import test from 'node:test';import assert from 'node:assert/strict';
import {reviewAndImprove} from './editorial-workflow.mjs';import {validateEditorial,EDITORIAL_VERSION} from './editorial.mjs';
const transcript={duration:1,segments:[{id:0,start:0,end:1,text:'Закройте линию.'}]};
const c={text:'Закройте линию.',citations:[{segment_id:0,quote:'Закройте линию.'}],rationale:'Source',checks:['actor_action','conditions_negation','modality_scope','terms_numbers','context_causality']};
const raw={format_version:EDITORIAL_VERSION,overview:[c],chapters:[{first:0,last:0,title:c,summary:c,points:[c]}],materials:{notes:[],exercises:[],glossary:[]},source_coverage:[{first:0,last:0,disposition:'summarized',reason:'Covered'}],terminology:[],limitations:[]};
const initial=()=>validateEditorial(raw,transcript);
test('a reviewer pass still repairs narrator-led summaries and rechecks the replacement',async()=>{
 const input=initial();
 input.chapters[0].summary={...c,text:'Говорящий объясняет закрытие линии.'};
 const calls=[];
 const result=await reviewAndImprove(input,transcript,[],async(name,instructions,payload)=>{
   calls.push(name);
   if(name.startsWith('semantic-repair')){
     assert.match(payload.review.issues[0],/Глава 1/);
     return {value:raw};
   }
   return {value:{pass:true,issues:[],notes:''}};
 });
 assert.equal(result.review.pass,true);
 assert.equal(result.editorial.chapters[0].summary.text,c.text);
 assert.equal(calls.length,3);
});
test('semantic feedback is corrected and independently reviewed before accepting',async()=>{
 const calls=[];const result=await reviewAndImprove(initial(),transcript,[],async(name)=>{calls.push(name);return {value:name.startsWith('semantic-repair')?{...raw,overview:[]}:calls.length===1?{pass:false,issues:['fixture issue'],notes:''}:{pass:true,issues:[],notes:''}};});
 assert.equal(calls.length,3);assert.equal(result.review.pass,true);
});
test('invalid correction or unavailable reviewer preserves source-validated draft with explicit failed review',async()=>{
 let calls=0;const result=await reviewAndImprove(initial(),transcript,[],async(name)=>{calls++;return {value:name.startsWith('semantic-repair')?{format_version:'invalid'}:{pass:false,issues:['Needs correction'],notes:''}};});
 assert.equal(calls,3);assert.equal(result.review.pass,false);assert.equal(result.editorial.overview[0].text,c.text);
 const offline=await reviewAndImprove(initial(),transcript,[],async()=>{throw Error('offline');});assert.equal(offline.review.pass,false);assert.ok(offline.review.issues.length);
});

const withPresentation = () => ({
  ...raw,
  presentation:{version:'hema-report-v1',title:c,subtitle:c,tags:[c]},
  materials:{...raw.materials,exercises:[{title:c,items:[{
    instruction_segment_id:0,instruction_quote:c.text,claims:[c]
  }]}]}
});
const cleanAudit = () => ({chapters:[{issues:[]}], exercises:[{issues:[]}]});
test('reader findings override a clean evidence review and the repaired reader view gets audited again', async () => {
  const draft = withPresentation();
  const stages = [];
  const result = await reviewAndImprove(validateEditorial(draft,transcript),transcript,[],async(name, _, payload) => {
    const stage = name.slice(0,name.lastIndexOf('-'));
    stages.push(stage);
    if (stage === 'review' || stage === 'reader-audit') {
      if (stages.includes('targeted-repair')) {
        assert.match(payload.revisionContext.priorIssues.join(' '),/Пропущен ориентир/);
        assert.deepEqual(payload.revisionContext.changedPaths,[['chapters',0,'points'],['overview']]);
      } else assert.equal(payload.revisionContext,undefined);
    }
    if (stage === 'review') return {value:{pass:true,issues:[],notes:''}};
    if (stage === 'targeted-repair') {
      assert.match(payload.review.issues.join(' '),/Глава 1:.*Упражнение 1:/);
      return {value:{edits:[{issue:0,path:['chapters',0,'points'],value:[]},{issue:1,path:['overview'],value:draft.overview}]}};
    }
    assert.equal(payload.report.materials.exercises[0].items[0].start,0);
    assert.equal(payload.report.materials.exercises[0].items[0].text,c.text);
    if (stages.length === 2) return {value:{chapters:[{issues:['Пропущен ориентир из сегмента 0.']}],
      exercises:[{issues:['В карточке нет исходного хвата, ссылка ведёт на команду повторить.']}]}};
    assert.deepEqual(payload.report.chapters[0].theses,[]);
    return {value:cleanAudit()};
  });
  assert.deepEqual(stages,['review','reader-audit','targeted-repair','review','reader-audit']);
  assert.equal(result.review.pass,true);
});
test('clean reader view needs two reviews; incomplete coverage, unresolved findings and reviewer suggestions cannot pass', async () => {
  const draft = withPresentation();
  for (const [audit, notes, allowed, calls] of [
    [cleanAudit(),'',true,2],
    [{chapters:[{issues:[]}],exercises:[]},'',false,2],
    [{chapters:[{issues:['Ориентир пропущен.']}],exercises:[{issues:[]}]},'',false,3],
    [cleanAudit(),'Укажите исходный хват.',false,3]
  ]) {
    let count = 0;
    const result = await reviewAndImprove(validateEditorial(draft,transcript),transcript,[],async(name) => {
      count++;
      if (name.startsWith('reader-audit')) return {value:audit};
      if (name.startsWith('targeted-repair')) return {value:{edits:[{issue:0,path:['overview'],value:draft.overview}]}};
      return {value:{pass:true,issues:[],notes}};
    });
    assert.equal(result.review.pass,allowed);
    assert.equal(count,calls);
  }
});

test('a misquoted revision has one targeted quote repair before independent review', async () => {
  const draft = structuredClone(raw);
  const invalid = structuredClone(draft);
  invalid.chapters[0].summary = {...c,text:'Закрытие линии.',citations:[{segment_id:0,quote:'Закрой линию.'}]};
  for (const [quote, allowed] of [[c.text,true],[null,false],['Invented',false]]) {
    const stages = [];
    const result = await reviewAndImprove(validateEditorial(draft,transcript),transcript,[],async(name, _, payload) => {
      const stage = name.slice(0,name.lastIndexOf('-'));
      stages.push(stage);
      if (stage === 'semantic-repair') return {value:invalid};
      if (stage === 'citation-repair') {
        assert.deepEqual(payload,[{claim:'Закрытие линии.',source:c.text,quote:'Закрой линию.'}]);
        return {value:{quotes:[quote]}};
      }
      if (stage === 'reader-audit') return {value:cleanAudit()};
      return {value:{pass:stages.length > 1,issues:stages.length > 1 ? [] : ['Уточните.'],notes:''}};
    });
    assert.equal(result.review.pass,allowed);
    assert.ok(stages.length <= 6);
    assert.equal(invalid.chapters[0].summary.citations[0].quote,'Закрой линию.');
  }
});

test('two editorial revisions can resolve successive findings',async()=>{
  let fixes=0,checks=0;
  const result=await reviewAndImprove(initial(),transcript,[],async name=>{
    if (name.startsWith('semantic-repair')) {
      fixes++;
      return {value:{...raw,overview:[{...c,text:'Версия '+fixes}]}};
    }
    checks++;
    return {value:{pass:fixes===2,issues:fixes===2?[]:['Уточните формулировку'],notes:''}};
  });
  assert.equal(checks,3);
  assert.equal(result.review.pass,true);
  assert.equal(result.editorial.overview[0].text,'Версия 2');
});

test('ten editorial calls bound a run even when new revisions keep reducing findings',async()=>{
  let calls=0,fixes=0;
  const result=await reviewAndImprove(initial(),transcript,[],async name=>{
    calls++;
    if (name.startsWith('semantic-repair')) return {value:{...raw,overview:[{...c,text:'Версия '+(++fixes)}]}};
    return {value:{pass:false,issues:Array.from({length:10-fixes},(_,i)=>'Замечание '+i),notes:''}};
  });
  assert.ok(calls<=10);
  assert.equal(fixes,4);
  assert.equal(result.editorial.overview[0].text,'Версия 4');
});

test('two regressions preserve the earlier version and its own review',async()=>{
  let fixes=0;
  const result=await reviewAndImprove(initial(),transcript,[],async name=>{
    if (name.startsWith('semantic-repair')) return {value:{...raw,overview:[{...c,text:'Вариант '+(++fixes)}]}};
    return {value:{pass:false,issues:Array(fixes+1).fill('Осталось замечание'),notes:''}};
  });
  assert.equal(fixes,2);
  assert.equal(result.editorial.overview[0].text,c.text);
  assert.equal(result.review.issues.length,1);
});

test('retry resumes the best completed review and edits only the outstanding field',async()=>{
 const {openSubmissions}=await import('./store.mjs');
 const store=openSubmissions(':memory:');
 try {
  const id=store.create('fixture','https://youtu.be/abcdefghijk',true);
  const first=store.claim();
  store.saveTranscript(id,first.lease,{...transcript,title:'Fixture',flags:[],provenance:{transcript_sha256:'a'.repeat(64)}});
  const improved={...raw,overview:[{...c,text:'Уточнённый обзор.'}]};
  let round=0;
  const pending={pass:false,issues:['Исправьте заголовок первой главы'],notes:''};
  const persist=({editorial,review})=>store.saveCandidate(id,first.lease,{...editorial,pendingReview:review});
  store.saveCandidate(id,first.lease,initial());
  await assert.rejects(reviewAndImprove(initial(),transcript,[],async name=>{
    if(name.startsWith('review-')) return {value:++round===1?{...pending,issues:['Нет обзора',...pending.issues]}:pending};
    if(round===2) throw Error('Worker lease lost');
    return {value:improved};
  },{saveBest:persist}),/lease lost/);
  persist({editorial:initial(),review:{...pending,issues:['Нет обзора',...pending.issues]}});
  store.fail(id,first.lease);
  const resumed=store.claim();
  const {pendingReview,...editorial}=resumed.candidate;
  assert.deepEqual(pendingReview,pending);
  assert.deepEqual(editorial.overview,improved.overview);
  assert.throws(()=>persist({editorial:initial(),review:pending}),/lease lost/);
  const calls=[];
  const result=await reviewAndImprove(editorial,transcript,[],async(name,_,input)=>{
    calls.push(name.split('-')[0]);
    if(name.startsWith('targeted-repair')){
      assert.deepEqual(input.review,pending);
      assert.deepEqual(input.draft,editorial);
      return {value:{edits:[{issue:0,path:['chapters',0,'title','text'],value:'Защита линии'}]}};
    }
    return {value:{pass:true,issues:[],notes:''}};
  },{pendingReview});
  assert.deepEqual(calls,['targeted','review']);
  const expected=structuredClone(editorial);
  expected.chapters[0].title.text='Защита линии';
  assert.deepEqual(result.editorial,expected);
  assert.equal(result.review.pass,true);
 } finally { store.close(); }
});

test('a rejected citation retries only its issue and the whole revised draft is checked',async()=>{
 const pendingReview={pass:false,issues:['Уточнить обзор','Исправить резюме'],notes:''};
 const repairs=[];
 const result=await reviewAndImprove(initial(),transcript,[],async(name,_,input)=>{
  if(name.startsWith('targeted-repair')){
   repairs.push(input.review.issues.slice());
   if(repairs.length===1) return {value:{edits:[
    {issue:0,path:['overview',0,'text'],value:'Защита линии.'},
    {issue:1,path:['chapters',0,'summary','citations'],value:[{segment_id:10,quote:c.text}]}
   ]}};
   assert.equal(input.draft.overview[0].text,'Защита линии.');
   assert.deepEqual(input.draft.chapters[0].summary,c);
   return {value:{edits:[{issue:0,path:['chapters',0,'summary','text'],value:'Закройте линию перед шагом.'}]}};
  }
  assert.equal(input.draft.overview[0].text,'Защита линии.');
  return {value:{pass:true,issues:[],notes:''}};
 },{pendingReview});
 assert.equal(repairs.length,2);
 assert.equal(repairs[1].length,1);
 assert.match(repairs[1][0],/Исправить резюме.*Unsupported citation/);
 assert.equal(result.review.pass,true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { modelJson, validateOrRepairEditorial, validateEditorial, repairDraftQuotes, EDITORIAL_VERSION } from './editorial.mjs';

test('targeted quote repair uses exact nearby evidence and never changes the original draft',async()=>{
  const segments=['Предупреждение','Сделайте шаг.','Неразборчиво'].map((text,id)=>({id,text}));
  const draft={chapters:[{title:{text:'Шаг',citations:[{segment_id:0,quote:'Сделайте шаг'}]}}]};
  const repair=answer=>repairDraftQuotes(draft,segments,[{segment_id:2}],async problems=>{
    assert.deepEqual(problems[0].sources.map(s=>s.id),[0,1]);
    return {citations:[answer]};
  });
  const corrected=await repair({segment_id:1,quote:'Сделайте шаг'});
  assert.equal(corrected.chapters[0].title.citations[0].segment_id,1);
  assert.equal(draft.chapters[0].title.citations[0].segment_id,0);
  await assert.rejects(repair({segment_id:2,quote:'Неразборчиво'}),/Unsupported/);
  await assert.rejects(repair(null),/Unsupported/);
});

test('archive format validates notes, exercise instruction anchors, terminology and full source ledger',async()=>{
  const transcript={duration:3,segments:[{id:0,start:0,end:1,text:'Закройте линию.'},{id:1,start:1,end:2,text:'Теперь шагните.'},{id:2,start:2,end:3,text:'Неразборчиво.'}]};
  const claim=id=>({text:transcript.segments[id].text,citations:[{segment_id:id,quote:transcript.segments[id].text}],rationale:'Direct instruction',checks:['actor_action','conditions_negation','modality_scope','terms_numbers','context_causality']});
  const data={format_version:EDITORIAL_VERSION,overview:[claim(0)],chapters:[{first:0,last:2,title:claim(0),summary:claim(0),points:[claim(1)]}],materials:{notes:[{title:claim(0),items:[claim(1)]}],exercises:[{title:claim(0),items:[{instruction_segment_id:1,instruction_quote:'Теперь шагните.',claims:[claim(1)]}]}],glossary:[]},source_coverage:[{first:0,last:1,disposition:'explicit_exercise',reason:'Task'},{first:2,last:2,disposition:'uncertain',reason:'Unclear'}],terminology:[{term:'линию',citations:claim(0).citations}],limitations:[{first:2,last:2,reason:'Requires audio review'}]};
  const flags=[{segment_id:2}];
  const inflected=structuredClone(data);
  inflected.terminology.push({term:'линия',citations:claim(0).citations});
  const repaired=await validateOrRepairEditorial(inflected,transcript,flags,()=>assert.fail('unnecessary regeneration'));
  assert.deepEqual(repaired.terminology,data.terminology);
  const result=validateEditorial(data,transcript,flags);
  assert.equal(result.materials.exercises[0].items[0].start,1);
  assert.equal(result.materials.notes[0].items[0].text,'Теперь шагните.');
  for (const mutate of [d=>d.source_coverage.pop(),d=>d.source_coverage[1].disposition='summarized',d=>d.materials.notes[0].items.push(claim(2)),d=>d.materials.exercises[0].items[0].instruction_quote='Invented',d=>d.overview[0].checks.pop(),d=>d.terminology[0].term='Invented']) {
    const bad=structuredClone(data);mutate(bad);assert.throws(()=>validateEditorial(bad,transcript,flags));
  }
});

test('repair is bounded to one attempt and cannot bypass exact source evidence',async()=>{
  const transcript={duration:2,segments:[{id:0,start:0,end:2,text:'Synthetic source.'}]};
  const claim={text:'Source',rationale:'Direct source',citations:[{segment_id:0,quote:'Synthetic source.'}]};
  const good={overview:[],chapters:[{first:0,last:0,title:claim,summary:claim,points:[]}]};
  let calls=0;
  await validateOrRepairEditorial(good,transcript,[],()=>{throw Error('unnecessary call');});
  const bad=structuredClone(good);bad.chapters[0].title.citations[0].quote='Invented';
  const result=await validateOrRepairEditorial(bad,transcript,[],async error=>{calls++;assert.equal(error,'Unsupported citation');return good;});
  assert.equal(result.chapters.length,1);assert.equal(calls,1);
  calls=0;
  await assert.rejects(validateOrRepairEditorial(bad,transcript,[],async()=>{calls++;return bad;}),/Unsupported citation/);
  assert.equal(calls,1);
});

test('JSON mode explicitly identifies JSON in the input message, not only instructions',async()=>{
  const input={segments:[{id:0,text:'Synthetic source.'}],flags:[]};
  const result=await modelJson({model:'fixture',key:'synthetic',instructions:'Return JSON.',input,fetcher:async(url,options)=>{
    const request=JSON.parse(options.body);
    assert.equal(request.stream,true);
    assert.equal(request.text.format.type,'json_object');
    assert.match(request.input,/json/i);
    assert.deepEqual(JSON.parse(request.input.slice(request.input.indexOf('\n')+1)),input);
    return Response.json({status:'completed',id:'fixture-response',output:[{content:[{type:'output_text',text:'{"ok":true}'}]}]});
  }});
  assert.deepEqual(result.value,{ok:true});
});

test('new worker contract refuses legacy format even after correction',async()=>{
  const transcript={duration:1,segments:[{id:0,start:0,end:1,text:'Source.'}]};
  const c={text:'Source.',citations:[{segment_id:0,quote:'Source.'}],rationale:'Direct'};
  const legacy={overview:[c],chapters:[{first:0,last:0,title:c,summary:c,points:[]}]};
  let calls=0;
  await assert.rejects(validateOrRepairEditorial(legacy,transcript,[],async()=>{calls++;return legacy;},true),/Require archive-skill-v2/);
  assert.equal(calls,1);
});

test('streamed JSON requires completed event and retains split UTF-8; partial output is not success',async()=>{
  const completed={type:'response.completed',response:{status:'completed',id:'stream-test',usage:{output_tokens:3},output:[{content:[{type:'output_text',text:JSON.stringify({text:'Смирение'})}]}]}};
  const stream=events=>{
    const bytes=new TextEncoder().encode(events);let offset=0;
    return new Response(new ReadableStream({pull(controller){if(offset>=bytes.length){controller.close();return;}controller.enqueue(bytes.slice(offset,offset+=7));}}),{headers:{'content-type':'text/event-stream'}});
  };
  const options={model:'fixture',key:'synthetic',instructions:'JSON',input:{}};
  const result=await modelJson({...options,fetcher:async()=>stream(': keepalive\r\n\r\ndata: '+JSON.stringify(completed)+'\r\n\r\n')});
  assert.deepEqual(result.value,{text:'Смирение'});assert.equal(result.responseId,'stream-test');
  await assert.rejects(modelJson({...options,fetcher:async()=>stream('data: {"type":"response.output_text.delta","delta":"partial"}\n\n')}),/without completion/);
  await assert.rejects(modelJson({...options,fetcher:async()=>stream('data: {"type":"response.incomplete"}\n\n')}),/Incomplete model response/);
});

test('only pre-request connect timeout permits one retry; ambiguous failures never retry',async()=>{
  const options={model:'fixture',key:'synthetic',instructions:'JSON',input:{}};
  let calls=0;
  const connection=()=>new TypeError('fetch failed',{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}});
  const result=await modelJson({...options,fetcher:async()=>{calls++;if(calls===1)throw connection();return Response.json({status:'completed',output:[{content:[{type:'output_text',text:'{"ok":true}'}]}]});}});
  assert.equal(calls,2);assert.equal(result.value.ok,true);
  calls=0;await assert.rejects(modelJson({...options,fetcher:async()=>{calls++;throw connection();}}));assert.equal(calls,2);
  for(const code of ['UND_ERR_SOCKET','UND_ERR_HEADERS_TIMEOUT']){calls=0;await assert.rejects(modelJson({...options,fetcher:async()=>{calls++;throw new TypeError('fetch failed',{cause:{code}});}}));assert.equal(calls,1);}
});

test('verbatim speech across a segment break keeps two exact in-chapter citations',()=>{
  const segments = ['При ответном',' действии смените плоскость.'].map((text,id)=>({id,start:id,end:id+1,text}));
  const transcript = {duration:2,segments};
  const cite = {text:'Смена плоскости',rationale:'Действие',citations:[{segment_id:1,quote:'ответном действии'}]};
  const chapter = {first:0,last:1,title:cite,summary:cite,points:[]};
  const data = {overview:[],chapters:[chapter]};
  assert.deepEqual(validateEditorial(data,transcript).chapters[0].title.citations,[
    {segment_id:0,quote:'ответном'},{segment_id:1,quote:'действии'}]);
  assert.throws(()=>validateEditorial(data,transcript,[{segment_id:0}]),/Unsupported citation/);
  cite.citations[0].quote='ответном движении';
  assert.throws(()=>validateEditorial(data,transcript),/Unsupported citation/);
});

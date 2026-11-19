import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSubmissions, youtubeUrl } from './store.mjs';
import { submissionHandler } from './http.mjs';
import { estimateProcessingUsd } from './processing-cost.mjs';
import { validateEditorial, modelJson } from './editorial.mjs';
import { siteServer } from '../site.mjs';
import { openAccessStore } from '../access-store.mjs';

const source = { duration:20, segments:[{id:0,start:0,end:10,text:'Не делайте шаг без защиты.'},{id:1,start:10,end:20,text:'Сначала закройте линию.'}] };
const claim = (id, text = source.segments[id].text) => ({text,citations:[{segment_id:id,quote:source.segments[id].text}],rationale:'Передано прямое указание с сохранением отрицания.'});
const editorial = () => ({overview:[claim(0)],chapters:[{first:0,last:1,title:claim(1),summary:claim(0),points:[claim(1)]}]});
const draft = () => ({...validateEditorial(editorial(),source),title:'Синтетическая запись',segments:source.segments,flags:[],review:{pass:true,issues:[],notes:'Synthetic fixture'}});

test('only canonical single-video HTTPS YouTube inputs; reject credentials and SSRF', () => {
  assert.equal(youtubeUrl('https://youtu.be/abcdefghijk?t=20'), 'https://www.youtube.com/watch?v=abcdefghijk');
  for (const url of ['http://youtu.be/abcdefghijk','https://youtube.com.evil.test/watch?v=abcdefghijk','https://127.0.0.1/video','https://user@youtube.com/watch?v=abcdefghijk','https://youtube.com:8000/watch?v=abcdefghijk','https://youtube.com/playlist?list=x','file:///etc/passwd']) assert.throws(() => youtubeUrl(url));
});
test('persistent queue, deduplication, quotas, leases, recovery and publication gates', () => {
  const dir = mkdtempSync(join(tmpdir(),'hema-submissions-'));
  let clock = 1000000, s = openSubmissions(join(dir,'jobs.sqlite'), {now:() => clock,authorLimit:1});
  try {
    const invite = s.issue(), author = s.author(invite.key);
    assert.equal(author,invite.id);
    assert.throws(() => s.create(author,'https://youtu.be/abcdefghijk',false));
    const id = s.create(author,'https://youtu.be/abcdefghijk',true);
    assert.equal(s.create(author,'https://youtu.be/abcdefghijk',true),id);
    assert.throws(() => s.create(author,'https://youtu.be/abcdefghijl',true));
    const job = s.claim(); assert.equal(job.id,id); assert.equal(s.claim(),null);
    assert.throws(() => s.finish(id,'wrong',draft()));
    s.close(); s = openSubmissions(join(dir,'jobs.sqlite'),{now:() => clock});
    assert.equal(s.get(id).state,'downloading');
    clock += 120001; s.claim(); assert.equal(s.get(id).state,'failed');
    assert.throws(() => s.finish(id,job.lease,draft()));
    const second = s.create('another','https://youtu.be/abcdefghijl',true), j2 = s.claim();
    s.finish(second,j2.lease,draft());
    assert.equal(s.publicList().length,0);
    assert.throws(() => s.decide(second,true,false));
    s.decide(second,true,true); assert.equal(s.publicList().length,1);
    assert.throws(() => s.decide(second,false,true));
    s.revoke(author); assert.equal(s.author(invite.key),undefined);
  } finally { s.close(); rmSync(dir,{recursive:true,force:true}); }
});
test('source coverage, uncertain segments, exact citations and incomplete API output fail closed', async () => {
  const good = editorial(); assert.equal(validateEditorial(good,source).chapters[0].start,0);
  assert.throws(() => validateEditorial(good,source,[{segment_id:0}]));
  good.chapters[0].last = 0; assert.throws(() => validateEditorial(good,source));
  const bad = editorial(); bad.overview[0].citations[0].quote = 'Делайте шаг'; assert.throws(() => validateEditorial(bad,source));
  await assert.rejects(modelJson({key:'test',model:'test',instructions:'',input:{},fetcher:async () => ({ok:true,json:async () => ({status:'incomplete'})})}));
});
test('failed editorial review cannot be published even with owner acknowledgement', () => {
  const s = openSubmissions(':memory:');
  try {
    const id = s.create('a','https://youtu.be/abcdefghijk',true), job = s.claim();
    assert.throws(()=>s.finish(id,job.lease,{...draft(),final_result:true,review:{pass:false,issues:['Lost negation'],notes:''}}),/review incomplete/);
    assert.throws(() => s.decide(id,true,true)); assert.equal(s.publicList().length,0);
  } finally {s.close();}
});
test('production server uses existing owner sessions and leaves intake disabled by default', async t => {
  const access = openAccessStore(':memory:'), store = openSubmissions(':memory:');
  const origin = 'http://127.0.0.1:4198';
  const server = siteServer(access,origin,{store}).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(() => {server.close();access.close();store.close();});
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const { request } = await import('node:http');
  const call = (path, cookie = '', data) => new Promise((accept,reject) => {
    const req = request(endpoint+path,{method:data ? 'POST':'GET',headers:{host:'127.0.0.1:4198',origin,cookie}},res => {
      let body = ''; res.on('data',c => body += c).on('end',() => accept({status:res.statusCode,body}));
    });req.on('error',reject);req.end(data);
  });
  const author = store.issue();
  assert.equal((await call('/submit/new',`hema_author=${author.key}`,'url=https%3A%2F%2Fyoutu.be%2Fabcdefghijk&consent=yes&processing=archive-publication-v2')).status,503);
  const id = store.create(author.id,'https://youtu.be/abcdefghijk',true), job = store.claim();
  store.finish(id,job.lease,draft());
  const session = access.login(access.issue('archive:owner'));
  store.place(id,author.id,{collection:'ovchinnikov-lectures',section:1,title:'',authors:['Александр Овчинников'],weapons:[]});
  assert.equal((await call(`/submit/${id}/publish`,`hema_local_session=${session}`,'reviewed=yes')).status,303);
  assert.equal((await call(`/community/${id}`)).status,303);
});
test('HTTP author isolation, CSRF, public visibility, owner publication and XSS escaping', async t => {
  const store = openSubmissions(':memory:');
  const handler = submissionHandler(store,{enabled:true});
  let origin;
  const server = createServer(async(req,res) => {
    if (!await handler({req,res,pathname:new URL(req.url,origin).pathname,origin,owner:req.headers['test-owner'] === 'yes'})) {res.writeHead(404);res.end();}
  }).listen(0,'127.0.0.1');
  await once(server,'listening'); origin = `http://127.0.0.1:${server.address().port}`;
  t.after(() => {server.close();store.close();});
  const a = store.issue(), b = store.issue();
  const call = (path, key, body, headers = {}) => fetch(origin+path,{redirect:'manual',method:body ? 'POST':'GET',headers:{cookie:key ? `hema_author=${key}`:'',origin,...headers},body:body ? new URLSearchParams(body):undefined});
  assert.equal((await call('/submit/new',null,{url:'https://youtu.be/abcdefghijk',processing:'archive-publication-v2'})).status,400);
  assert.equal((await call('/submit/new',a.key,{url:'https://youtu.be/abcdefghijk',consent:'yes',processing:'archive-publication-v2'},{origin:'https://evil.test'})).status,403);
  assert.equal((await call('/submit/new',a.key,{url:'https://youtu.be/abcdefghijk',consent:'yes'})).status,400);
  const invalid = await call('/submit/new',a.key,{url:'https://example.com/video',consent:'yes',processing:'archive-publication-v2'});
  assert.equal(invalid.status,400);
  const invalidHtml=await invalid.text();
  assert.ok(invalidHtml.includes('value="https://example.com/video"'));
  assert.ok(invalidHtml.includes('action="/submit/new"'));
  assert.match(invalidHtml,/role="alert"/);
  const submitted = await call('/submit/new',a.key,{url:'https://youtu.be/abcdefghijk',consent:'yes',processing:'archive-publication-v2'});
  assert.equal(submitted.status,303); const path = submitted.headers.get('location'), id = path.split('/').at(-1);
  assert.equal((await call(path,b.key)).status,404);
  assert.equal((await call(path,a.key)).status,200);
  assert.equal((await call('/community/'+id)).status,404);
  const job = store.claim(), report = draft(); report.title = '<script>alert(1)</script>';
  const usage = {input_tokens:12000,input_tokens_details:{cached_tokens:4000,cache_write_tokens:7000,cache_write_tokens_details:{ttl_30m_tokens:3000,ttl_12h_tokens:4000}},output_tokens:1000};
  const estimate = estimateProcessingUsd(3600,'gpt-6.1-terra',new Map([['generation',{usage}],['review',{usage}]]));
  assert.ok(Math.abs(estimate - .3999) < 1e-9);
  assert.equal(estimateProcessingUsd(3600,'gpt-6.1-terra',new Map([['generation',{}]])),null);
  report.provenance = {processing_estimate_usd:estimate};
  report.materials={notes:[{title:claim(0,'Study notes'),items:[claim(0,'<script>unsafe</script>')]}],exercises:[],glossary:[]};
  report.limitations=[{first:0,last:0,reason:'Private diagnostic sentinel',reader_text:'Reader limitation <escaped>'}];
  store.finish(id,job.lease,report);
  const styled=await (await call(path,a.key)).text();
  assert.match(styled,/около 33\s*₽/);
  assert.match(styled,/Александр Овчинников оплачивает обработку видео из личных средств/);
  assert.match(styled,/Параметры публикации/);
  assert.ok(styled.includes('https://vk.ru/alex_liam'));
  assert.ok(styled.includes('https://t.me/Alex_Liam'));
  assert.doesNotMatch(styled,/http-equiv="refresh"/);
  assert.equal(store.list(a.id)[0].title,'<script>alert(1)</script>');
  const listHtml=await (await call('/submit/',a.key)).text();
  assert.ok(listHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.match(listHtml,/id="my-videos"/);
  assert.match(styled,/id="main-points"/);assert.match(styled,/id="notes"/);
  assert.match(styled,/&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(styled,/id="exercises"/);
  assert.match(styled,/Reader limitation &lt;escaped&gt;/);
  assert.doesNotMatch(styled,/Private diagnostic sentinel/);
  assert.equal((await call(path+'/publish',a.key,{reviewed:'yes'})).status,403);
  assert.equal((await call(path+'/publish',null,{reviewed:'yes'},{'test-owner':'yes'})).status,303);
  const published = await call('/community/'+id); assert.equal(published.status,200);
  const html = await published.text(); assert.ok(!html.includes('<script>alert')); assert.ok(html.includes('&lt;script&gt;'));
  store.revoke(a.id); assert.equal((await call(path,a.key)).status,404);
});



test('guest can paste link without invitation; result remains private and quota is global',async t=>{
 const store=openSubmissions(':memory:',{dailyLimit:2});let origin;
 const handler=submissionHandler(store,{enabled:true,archiveCollections:()=>[{slug:'test',title:'Тестовая коллекция',hema:true}]});
 const server=createServer(async(req,res)=>{await handler({req,res,pathname:new URL(req.url,origin).pathname,origin,owner:false});}).listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;
 t.after(()=>{server.close();store.close();});
 const submit=()=>fetch(origin+'/submit/new',{method:'POST',redirect:'manual',headers:{origin},body:new URLSearchParams({url:'https://youtu.be/abcdefghijk',consent:'yes',processing:'archive-publication-v2'})});
 assert.match(await (await fetch(origin+'/submit/')).text(),/Ссылка на видео YouTube/);
 const first=await submit();assert.equal(first.status,303);const cookie=first.headers.get('set-cookie').split(';')[0],path=first.headers.get('location');
 const second=await submit();assert.equal(second.status,303);assert.notEqual(first.headers.get('location'),second.headers.get('location'));
 assert.equal((await fetch(origin+path)).status,404);
 assert.equal((await fetch(origin+path,{headers:{cookie:second.headers.get('set-cookie').split(';')[0]}})).status,404);
 assert.equal((await fetch(origin+path,{headers:{cookie}})).status,200);
 assert.equal(store.get(path.split('/').at(-1)).placement.requested,true);
 const queuedHtml=await (await fetch(origin+path,{headers:{cookie}})).text();
 assert.match(queuedHtml,/http-equiv="refresh"/);
 assert.match(queuedHtml,/Видео принято/);
 assert.doesNotMatch(queuedHtml,/Поддержать архив/);
 assert.doesNotMatch(queuedHtml,/<form/);
 assert.doesNotMatch(await (await fetch(origin+path,{headers:{cookie}})).text(),/name="collection"/);
 assert.match((await fetch(origin+path,{headers:{cookie}})).headers.get('cache-control'),/no-store/);
 assert.equal((await submit()).status,400);assert.equal(store.publicList().length,0);
});

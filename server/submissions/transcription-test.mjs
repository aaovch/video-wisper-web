import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openSubmissions, hash } from './store.mjs';
import { normalizeTranscript, validateChunks, requestTranscription, transcribeJob, assertTranscriptionAvailable } from './transcription.mjs';

const response = (duration = 10) => ({body:{duration,text:'Не шагайте.',segments:[{start:0.125,end:1.75,text:'Не шагайте.',avg_logprob:-.1,no_speech_prob:.01,compression_ratio:1}],words:[{start:.125,end:.25,word:'Не'},{start:.3,end:1.75,word:'шагайте.'}]}});
function temporary(t) {
  const dir = mkdtempSync(join(tmpdir(),'hema-cloud-test-'));
  t.after(() => {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep) || !dir.includes('hema-cloud-test-')) throw Error('Unsafe test cleanup');
    rmSync(dir,{recursive:true,force:true});
  });
  return dir;
}
test('API word and segment timestamps retain fractional offsets across chunks', () => {
  const chunks = [{offset:0,duration:599.75,quiet_boundary:true},{offset:599.75,duration:10,quiet_boundary:true}];
  const {transcript} = normalizeTranscript(chunks,[response(599.75),response()],609.75);
  assert.equal(transcript.segments[1].start,599.875);
  assert.equal(transcript.segments[1].end,601.5);
  assert.equal(transcript.words[2].start,599.875);
  assert.equal(transcript.words[3].end,601.5);
  assert.deepEqual(transcript.segments.map(s => s.id),[0,1]);
});
test('reconcile small Whisper segment overlaps while preserving text and word alignment', () => {
  const chunks = [{offset:0,duration:10,quiet_boundary:true}];
  const r = response();
  r.body.segments = [{start:.125,end:.75,text:'Не'}, {start:.25,end:1.75,text:'шагайте.'}];
  const {transcript} = normalizeTranscript(chunks,[r],10);
  assert.deepEqual(transcript.segments.map(s => [s.start,s.end,s.text]), [[.125,.75,'Не'],[.75,1.75,'шагайте.']]);
  assert.deepEqual(transcript.words.map(({chunk,...word}) => word),r.body.words);
  assert.equal(r.body.segments[1].start,.25);
  r.body.segments[1].end = .7;
  assert.throws(() => normalizeTranscript(chunks,[r],10),/Overlapping/);
  r.body.segments[1].end = 1.75;
  r.body.segments[1].start = .24;
  assert.throws(() => normalizeTranscript(chunks,[r],10),/Overlapping/);
});
test('reject fabricated, missing, reversed and incomplete timing data', () => {
  const chunks = [{offset:0,duration:10,quiet_boundary:false}];
  for (const mutate of [r => r.body.segments[0].end = 11,r => r.body.segments[0].end = 0,r => r.body.duration = 20,r => r.body.text += ' Пропущенные слова.']) {
    const r = response(); mutate(r); assert.throws(() => normalizeTranscript(chunks,[r],10));
  }
  assert.throws(() => normalizeTranscript(chunks,[],10));
  const uncertain = response(); uncertain.body.segments[0].avg_logprob = -2;
  const result = normalizeTranscript(chunks,[uncertain],10);
  assert.equal(result.flags[0].segment_id,0);
  assert.ok(result.flags.some(f => f.reasons.includes('cut_without_silence_review')));
});
test('retain point-aligned API words exactly without permitting reversed words or empty segments',()=>{
  const chunks=[{offset:20,duration:10,quiet_boundary:true}];
  const r=response(); r.body.words[0].end=r.body.words[0].start;
  const result=normalizeTranscript(chunks,[r],30);
  assert.equal(result.transcript.words[0].start,20.125);
  assert.equal(result.transcript.words[0].end,20.125);
  r.body.words[0].end=0;
  assert.equal(normalizeTranscript(chunks,[r],30).transcript.words.length,0);
  r.body.words[0].end=r.body.words[0].start;
  r.body.segments[0].end=r.body.segments[0].start;
  assert.throws(()=>normalizeTranscript(chunks,[r],30));
});
test('omit empty alignment entries but still require complete word text coverage',()=>{
  const chunks=[{offset:0,duration:10,quiet_boundary:true}];
  const r=response();r.body.words.splice(1,0,{word:'',start:.25,end:.3});
  r.body.segments.push({text:'',start:2,end:2});
  assert.equal(normalizeTranscript(chunks,[r],10).transcript.segments.length,1);
  assert.equal(normalizeTranscript(chunks,[r],10).transcript.words.length,2);
  r.body.words[2].word='';
  assert.equal(normalizeTranscript(chunks,[r],10).transcript.words.length,0);
});
test('multipart requests use cloud timestamps, abort signal and no retry on error', async () => {
  let calls = 0;
  const fetcher = async(url,options) => {
    calls++; assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');
    assert.equal(options.body.get('model'),'whisper-1');
    assert.equal(options.body.get('response_format'),'verbose_json');
    assert.deepEqual(options.body.getAll('timestamp_granularities[]'),['segment','word']);
    assert.equal(options.body.get('file').type,'audio/wav');
    assert.equal(options.headers['Content-Type'],undefined); // fetch supplies boundary
    assert.ok(options.signal);
    return new Response('limited',{status:429});
  };
  await assert.rejects(requestTranscription(Buffer.from('audio'),{key:'synthetic',fetcher}),/429/);
  assert.equal(calls,1);
  assert.throws(() => assertTranscriptionAvailable(Date.parse('2027-02-26T00:00:00Z')));
});
test('persist raw API results and hashes; reuse verified results without paying again', async t => {
  const dir = temporary(t); mkdirSync(join(dir,'chunks'));
  const bytes = Buffer.from('synthetic audio bytes');
  writeFileSync(join(dir,'audio.wav'),bytes); writeFileSync(join(dir,'chunks','0000.wav'),bytes);
  const source = {duration:10,audio_sha256:hash(bytes)};
  const manifest = {sample_rate:16000,total_frames:160000,source_audio_sha256:hash(bytes),chunks:[{file:'0000.wav',start_frame:0,end_frame:160000,offset:0,duration:10,quiet_boundary:true,sha256:hash(bytes)}]};
  writeFileSync(join(dir,'source.json'),JSON.stringify(source)); writeFileSync(join(dir,'chunks.json'),JSON.stringify(manifest));
  validateChunks(manifest,source);
  const bad = structuredClone(manifest); bad.chunks[0].start_frame = 1; assert.throws(() => validateChunks(bad,source));
  let calls = 0;
  const config = {key:'synthetic',now:Date.parse('2026-11-05'),fetcher:async() => {calls++;return new Response(JSON.stringify(response().body),{headers:{'x-request-id':'test-request'}});}};
  const result = await transcribeJob(dir,config);
  assert.equal(result.provenance.transcript_sha256,hash(readFileSync(join(dir,'openai-transcription','transcript.json'))));
  assert.equal(JSON.parse(readFileSync(join(dir,'openai-transcription','0.json'))).request_id,'test-request');
  await transcribeJob(dir,config); assert.equal(calls,1);
  writeFileSync(join(dir,'chunks','0000.wav'),'tampered'); await assert.rejects(transcribeJob(dir,config),/hash/);
});
test('an ambiguous failed API request is never repeated and never marked complete', async t => {
  const dir = temporary(t); mkdirSync(join(dir,'chunks'));
  const bytes = Buffer.from('synthetic audio');
  writeFileSync(join(dir,'audio.wav'),bytes);writeFileSync(join(dir,'chunks','0000.wav'),bytes);
  writeFileSync(join(dir,'source.json'),JSON.stringify({duration:10,audio_sha256:hash(bytes)}));
  writeFileSync(join(dir,'chunks.json'),JSON.stringify({sample_rate:16000,total_frames:160000,source_audio_sha256:hash(bytes),chunks:[{file:'0000.wav',start_frame:0,end_frame:160000,offset:0,duration:10,sha256:hash(bytes)}]}));
  let calls = 0;
  const config = {key:'synthetic',now:Date.parse('2026-11-05'),fetcher:async() => {calls++;throw Error('timeout');}};
  await assert.rejects(transcribeJob(dir,config),/timeout/);
  await assert.rejects(transcribeJob(dir,config),/EEXIST/);
  assert.equal(calls,1); assert.equal(existsSync(join(dir,'openai-transcription','manifest.json')),false);
});
test('legacy queued jobs need fresh audio consent and another author cannot grant it', t => {
  const dir = temporary(t), file = join(dir,'jobs.sqlite');
  let store = openSubmissions(file);
  const id = store.create('author','https://youtu.be/abcdefghijk',true); store.close();
  const db = new DatabaseSync(file); db.exec('ALTER TABLE submissions DROP COLUMN cloud_audio_consent'); db.close();
  store = openSubmissions(file);
  try {
    assert.equal(store.get(id).state,'consent_required'); assert.equal(store.claim(),null);
    assert.throws(() => store.consent(id,'other')); store.consent(id,'author');
    assert.equal(store.claim().id,id);
  } finally {store.close();}
});

test('overlapping phrases preserve both repeated words across a point timestamp',()=>{
  const chunks=[{offset:0,duration:10,quiet_boundary:true}];
  const r=response();
  r.body.text='Да. Да.';
  r.body.segments=[{start:0,end:5,text:'Да.'},{start:4.72,end:7,text:' Да.'}];
  r.body.words=[{start:5,end:5,word:'Да'},{start:4.72,end:5.2,word:'Да'}];
  const {transcript}=normalizeTranscript(chunks,[r],10);
  assert.deepEqual(transcript.words.map(w=>w.start),[5,5]);
  assert.deepEqual(transcript.segments.map(s=>s.text),['Да.',' Да.']);
  assert.equal(r.body.words[1].start,4.72);
  delete r.body.words;
  const fallback=normalizeTranscript(chunks,[r],10);
  assert.deepEqual(fallback.transcript.segments,transcript.segments);
  assert.ok(fallback.flags.some(f=>f.reasons.includes('word_alignment_unavailable')));
});

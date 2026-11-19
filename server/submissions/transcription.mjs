import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hash } from './store.mjs';

// The documented API offering word + segment timestamps. Never silently replace
// it with a text-only model or fabricate timestamps with the editorial model.
export const TRANSCRIPTION_MODEL = 'whisper-1';
export const TRANSCRIPTION_SUNSET = '2027-02-26T00:00:00Z';
export function assertTranscriptionAvailable(now = Date.now()) {
  if (now >= Date.parse(TRANSCRIPTION_SUNSET)) throw Error('Cloud whisper-1 timestamp support has reached its announced shutdown date; migrate before accepting jobs');
}
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2), { mode:0o600, flag:'wx' });

export function validateChunks(manifest, source) {
  if (manifest.sample_rate !== 16000 || !Number.isSafeInteger(manifest.total_frames) || manifest.total_frames <= 0 || Math.abs(manifest.total_frames / 16000 - source.duration) > 0.0001 || manifest.source_audio_sha256 !== source.audio_sha256 || !Array.isArray(manifest.chunks) || !manifest.chunks.length || manifest.chunks.length > 13) throw Error('Invalid audio manifest');
  let next = 0;
  for (const [i, c] of manifest.chunks.entries()) {
    if (c.file !== `${String(i).padStart(4,'0')}.wav` || c.start_frame !== next || !Number.isSafeInteger(c.end_frame) || c.end_frame <= next || c.end_frame > manifest.total_frames || c.offset !== next / 16000 || c.duration !== (c.end_frame - next) / 16000 || c.duration > 600 || !/^[a-f0-9]{64}$/.test(c.sha256)) throw Error('Audio chunks have gaps, overlap or invalid offsets');
    next = c.end_frame;
  }
  if (next !== manifest.total_frames) throw Error('Missing audio tail');
}

export async function requestTranscription(bytes, { key, signal, fetcher = fetch }) {
  if (!bytes.length || bytes.length > 24_000_000) throw Error('Audio chunk exceeds upload limit');
  const form = new FormData();
  form.set('file', new Blob([bytes], { type:'audio/wav' }), 'audio.wav');
  form.set('model', TRANSCRIPTION_MODEL);
  form.set('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  form.append('timestamp_granularities[]', 'word');
  form.set('temperature', '0');
  const response = await fetcher('https://api.openai.com/v1/audio/transcriptions', {
    method:'POST', headers:{ Authorization:`Bearer ${key}` }, body:form,
    signal:AbortSignal.any([AbortSignal.timeout(300000), ...(signal ? [signal] : [])])
  });
  if (!response.ok) throw Error(`OpenAI transcription failed (${response.status}); no automatic retry`);
  return { body:await response.json(), request_id:response.headers.get('x-request-id') };
}

export function normalizeTranscript(chunks, responses, duration) {
  const segments = [], words = [], flags = [];
  if (responses.length !== chunks.length) throw Error('Missing transcription response');
  for (const [index, chunk] of chunks.entries()) {
    const body = responses[index].body;
    if (!Number.isFinite(body.duration) || Math.abs(body.duration - chunk.duration) > 0.5 || typeof body.text !== 'string' || !Array.isArray(body.segments)) throw Error('Transcription lacks duration or word/segment timestamps');
    if (body.text.trim() && !body.segments.length) throw Error('Text without timestamps');
    const bounds = (rows, field) => {
      let previous = -1;
      for (const row of rows) {
        // Whisper can align a word to a single instant. Preserve that point;
        // do not invent a positive duration. Segments still need an interval.
        if (!Number.isFinite(row.start) || !Number.isFinite(row.end) || row.start < 0 || row.end < row.start || (field === 'text' && row.end === row.start) || row.end > chunk.duration || row.start < previous || typeof row[field] !== 'string' || !row[field].trim()) throw Error('Invalid or out-of-order API timestamps');
        previous = row.start;
      }
    };
    // Empty alignment entries carry no word. Keep the raw API response on disk,
    // but omit these entries from the word index; text coverage is checked below.
    const segmentRows = body.segments.filter(row => !(typeof row.text === 'string' && !row.text.trim() && row.start === row.end));
    // Whisper can start the next segment before the final word of the
    // previous segment. Match the same small boundary adjustment for words.
    // Raw responses are preserved. Other reversals still fail validation.
    const boundaries = new Map();
    for (let i=1;i<segmentRows.length;i++) {
      const {start,end}=segmentRows[i], boundary=segmentRows[i-1].end;
      if (start<boundary && boundary-start<=0.5 && boundary<end) boundaries.set(start,boundary);
    }
    const timedWords = Array.isArray(body.words) ? body.words.filter(row => row?.word?.trim?.()) : [];
    let previousStart=-1;
    let wordRows = timedWords.map(word=>{
      const boundary=boundaries.get(word.start);
      if (word.start<previousStart && previousStart===boundary && word.end>=boundary) {
        return {...word,start:boundary};
      }
      previousStart=word.start;
      return word;
    });
    bounds(segmentRows,'text');
    const normalizedText = text => text.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLocaleLowerCase();
    if (normalizedText(body.text) !== normalizedText(body.segments.map(s => s.text).join(' '))) throw Error('Timed transcription does not cover full response text');
    // Chapters depend on complete timed segments. A broken auxiliary word
    // index can be omitted for this chunk without discarding any spoken text.
    try {
      bounds(wordRows,'word');
      if (normalizedText(body.text) !== normalizedText(wordRows.map(s=>s.word).join(' '))) throw Error('Incomplete word alignment');
    } catch {
      wordRows=[];
      flags.push({id:`words-${index}`,start:chunk.offset,end:chunk.offset+chunk.duration,reasons:['word_alignment_unavailable']});
    }
    for (const row of segmentRows) {
      const id = segments.length;
      let start = chunk.offset + row.start;
      const end = chunk.offset + row.end;
      const previous = segments.at(-1);
      if (previous && start < previous.end) {
        // Allow up to half a second of Whisper boundary jitter within one response.
        // Keep the raw response and word alignment intact for source verification.
        if (previous.chunk !== index || previous.end - start > 0.5 || previous.end >= end) throw Error('Overlapping transcript segments');
        start = previous.end;
      }
      segments.push({ ...row, id, start, end, chunk:index });
      const reasons = [];
      if (row.avg_logprob < -1) reasons.push('low_logprob');
      if (row.no_speech_prob > .6) reasons.push('no_speech_probability');
      if (row.compression_ratio > 2.4) reasons.push('compression');
      if (id && row.text.trim() === segments[id-1].text.trim()) reasons.push('repeat');
      if (reasons.length) flags.push({ id:`segment-${id}`, segment_id:id, start,end,reasons });
    }
    words.push(...wordRows.map(w => ({ ...w, start:chunk.offset + w.start, end:chunk.offset + w.end, chunk:index })));
    if (!chunk.quiet_boundary) flags.push({ id:`boundary-${index}`,start:chunk.offset+chunk.duration-2,end:chunk.offset+chunk.duration+2,reasons:['cut_without_silence_review'] });
  }
  if (!segments.length) throw Error('No speech found');
  let end = 0;
  for (const s of segments) {
    if (s.start - end > 20) flags.push({id:`gap-${s.id}`,start:end,end:s.start,reasons:['speech_gap_review']});
    end = s.end;
  }
  if (duration - end > 10) flags.push({id:'tail',start:end,end:duration,reasons:['uncovered_tail']});
  return { transcript:{duration,segments,words}, flags };
}

export async function transcribeJob(dir, { key, signal, fetcher, ensureLease = () => {}, now = Date.now() }) {
  assertTranscriptionAvailable(now);
  const source = read(join(dir,'source.json')), manifest = read(join(dir,'chunks.json'));
  validateChunks(manifest, source);
  if (hash(readFileSync(join(dir,'audio.wav'))) !== source.audio_sha256) throw Error('Source audio hash mismatch');
  const output = join(dir,'openai-transcription'); mkdirSync(output,{recursive:true,mode:0o700});
  const responses = [];
  for (const [index, chunk] of manifest.chunks.entries()) {
    await ensureLease(); signal?.throwIfAborted();
    const bytes = readFileSync(join(dir,'chunks',chunk.file));
    if (hash(bytes) !== chunk.sha256) throw Error('Audio chunk hash mismatch');
    const target = join(output,`${index}.json`), request = join(output,`${index}.request.json`);
    if (existsSync(target)) {
      const cached = read(target);
      if (cached.audio_sha256 !== chunk.sha256 || cached.model !== TRANSCRIPTION_MODEL) throw Error('Stale transcription cache');
      responses.push(cached);
      continue;
    }
    // A timeout may already have been billed. Never retry an ambiguous request.
    save(request, { model:TRANSCRIPTION_MODEL,audio_sha256:chunk.sha256,offset:chunk.offset,duration:chunk.duration });
    const result = await requestTranscription(bytes, {key,signal,fetcher});
    const record = {...result,model:TRANSCRIPTION_MODEL,audio_sha256:chunk.sha256};
    save(target,record); responses.push(record);
  }
  await ensureLease();
  const {transcript,flags} = normalizeTranscript(manifest.chunks,responses,source.duration);
  const transcriptPath = join(output,'transcript.json');
  if (!existsSync(transcriptPath)) save(transcriptPath,transcript);
  else if (JSON.stringify(read(transcriptPath)) !== JSON.stringify(transcript)) throw Error('Cached transcript differs');
  const provenance = {provider:'openai',model:TRANSCRIPTION_MODEL,timestamps:flags.some(f=>f.reasons.includes('word_alignment_unavailable')) ? 'api-segment-with-partial-word-alignment' : 'api-word-and-segment',source_audio_sha256:source.audio_sha256,transcript_sha256:hash(readFileSync(transcriptPath)),chunk_count:manifest.chunks.length};
  if (!existsSync(join(output,'manifest.json'))) save(join(output,'manifest.json'),{...provenance,status:'complete',full_source:true});
  return {transcript,flags,provenance};
}

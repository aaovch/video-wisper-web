import {reportFormat,materialInstructions,fidelityChecks,validateReportFormat,validateReaderLimitation,editorialContent} from './report-format.mjs';
export const EDITORIAL_VERSION = 'archive-skill-v2';
export const editorialInstructions = `Prepare a Russian HEMA archive report. Apply the shared material policy below.
${materialInstructions('prepare')}
Cloud input adapter: supplied segments and flags are the available source. No audio, video or verified metadata evidence channel is supplied to this call. Flagged speech remains unresolved and cannot support definite assertions.
Every Claim is ONE atomic assertion or faithful heading: {text:string,citations:[{segment_id:number,quote:string}],rationale:string,checks:${JSON.stringify(fidelityChecks)}}. Quotes must be exact nonempty substrings. All chapter claims cite only within that chapter interval. For each exercise include instruction_segment_id and instruction_quote from its actual instruction; its claims must include that citation.
Return JSON only:
{format_version:"archive-skill-v2",presentation:{version:"hema-report-v1",title:Claim,subtitle:Claim,tags:Claim[]},overview:Claim[],chapters:[{first:number,last:number,title:Claim,summary:Claim,points:Claim[]}],materials:{notes:[{title:Claim,items:Claim[]}],exercises:[{title:Claim,items:[{instruction_segment_id:number,instruction_quote:string,claims:Claim[]}]}],glossary:[{term:Claim,definition:Claim}]},source_coverage:[{first:number,last:number,disposition:"summarized"|"supporting_detail"|"explicit_exercise"|"non_substantive"|"uncertain",reason:string}],terminology:[{term:string,citations:[{segment_id:number,quote:string}]}],limitations:[{first:number,last:number,reason:string,reader_text:string}]}.
Chapter intervals together cover all segments once in order starting at 0; select boundaries by topics, not fixed durations. Empty optional lists are allowed; do not fill templates with invented content. Use limitations for unclear source, not for new factual claims. reason is private technical evidence; reader_text is a concise plain-language explanation for the reader. Every limitation requires both. presentation title/subtitle/tags need real citations just like all other claims. Follow the common title/subtitle/tag limits: ${JSON.stringify(reportFormat.limits)}. Overview and notes should be concise and substantive. Re-read every claim against source context before returning. If a faithful report is impossible return {error:"reason"}.`;

export function validateEditorial(value, transcript, flags = []) {
  const segments = transcript.segments;
  if (!segments?.length || segments.some((s, i) => s.id !== i || !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start < 0 || s.end < s.start || s.end > transcript.duration + 1 || (i && s.start < segments[i - 1].start) || typeof s.text !== 'string')) throw Error('Invalid transcript');
  const uncertain = new Set(flags.filter(f => Number.isInteger(f.segment_id)).map(f => f.segment_id));
  const claim = (item, first = 0, last = segments.length - 1) => {
    if (!item || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 2500 || typeof item.rationale !== 'string' || !item.rationale.trim() || !Array.isArray(item.citations) || !item.citations.length) throw Error('Missing atomic evidence');
    const citations = [];
    for (const {segment_id:id, quote} of item.citations) {
      if (!Number.isInteger(id) || id < first || id > last || uncertain.has(id) || typeof quote !== 'string' || !quote.trim()) throw Error('Unsupported citation');
      if (segments[id].text.includes(quote)) {
        citations.push({segment_id:id, quote});
        continue;
      }
      // Whisper can split a verbatim phrase between consecutive segments.
      // Keep both exact source slices, inside the same permitted interval.
      const left = segments[id - 1]?.text.trimEnd();
      const right = segments[id].text.trimStart();
      const next = segments[id + 1]?.text.trimStart();
      const split = (a,b) => {
        if (!a || !b) return null;
        for (let i=quote.indexOf(' '); i>=0; i=quote.indexOf(' ',i+1)) {
          const before=quote.slice(0,i), after=quote.slice(i+1);
          if (before.trim() && after.trim() && a.endsWith(before) && b.startsWith(after)) return [before,after];
        }
        return null;
      };
      const previous = id > first && !uncertain.has(id-1) && split(left,right);
      const following = id < last && !uncertain.has(id+1) && split(segments[id].text.trimEnd(),next);
      if ((!previous && !following) || (previous && following)) throw Error('Unsupported citation');
      const start = previous ? id-1 : id;
      const parts = previous || following;
      citations.push({segment_id:start, quote:parts[0]}, {segment_id:start+1, quote:parts[1]});
    }
    if (value.format_version === EDITORIAL_VERSION && (!Array.isArray(item.checks) || fidelityChecks.some(key => !item.checks.includes(key)))) throw Error('Missing fidelity checks');
    return { text:item.text, citations, rationale:item.rationale, ...(value.format_version === EDITORIAL_VERSION ? {checks:item.checks} : {}) };
  };
  if (!Array.isArray(value.overview) || value.overview.length > reportFormat.limits.overviewSentences || !Array.isArray(value.chapters) || !value.chapters.length || value.chapters.length > 150) throw Error('Invalid editorial structure');
  let next = 0;
  const chapters = value.chapters.map(c => {
    if (c.first !== next || !Number.isInteger(c.last) || c.last < c.first || c.last >= segments.length || !Array.isArray(c.points) || c.points.length > 100) throw Error('Incomplete source coverage');
    next = c.last + 1;
    return { first:c.first, last:c.last, start:segments[c.first].start, anchor:segments[c.first].text, title:claim(c.title,c.first,c.last), summary:claim(c.summary,c.first,c.last), points:c.points.map(p => claim(p,c.first,c.last)) };
  });
  if (next !== segments.length) throw Error('Uncovered transcript tail');
  const result = { overview:value.overview.map(c => claim(c)), chapters };
  if (value.format_version !== undefined && value.format_version !== EDITORIAL_VERSION) throw Error('Unknown editorial format');
  if (value.format_version === EDITORIAL_VERSION) {
    const list = (items, max=200) => { if (!Array.isArray(items) || items.length > max) throw Error('Invalid editorial list'); return items; };
    const interval = item => {
      if (!Number.isInteger(item.first) || !Number.isInteger(item.last) || item.first < 0 || item.last < item.first || item.last >= segments.length || typeof item.reason !== 'string' || !item.reason.trim() || item.reason.length > 2500) throw Error('Invalid source ledger interval');
      return {first:item.first,last:item.last,reason:item.reason};
    };
    let cursor=0;
    const coverage=list(value.source_coverage,segments.length).map(item=>{
      const range=interval(item);
      if (range.first !== cursor || !['summarized','supporting_detail','explicit_exercise','non_substantive','uncertain'].includes(item.disposition)) throw Error('Incomplete source ledger');
      for (let id=range.first;id<=range.last;id++) if (uncertain.has(id) && item.disposition !== 'uncertain') throw Error('Unreviewed flagged source');
      cursor=range.last+1;return {...range,disposition:item.disposition};
    });
    if (cursor !== segments.length) throw Error('Incomplete source ledger');
    const materials=value.materials;
    if (!materials || 'long_summary' in value) throw Error('Invalid archive materials');
    const notes=list(materials.notes).map(n=>({title:claim(n.title),items:list(n.items).map(c=>claim(c))}));
    const exercises=list(materials.exercises).map(section=>({title:claim(section.title),items:list(section.items).map(item=>{
      const id=item.instruction_segment_id, quote=item.instruction_quote;
      if (!Number.isInteger(id) || !segments[id] || uncertain.has(id) || typeof quote !== 'string' || !quote.trim() || !segments[id].text.includes(quote)) throw Error('Invalid exercise instruction');
      const claims=list(item.claims).map(c=>claim(c));
      if (!claims.length || !claims.some(c=>c.citations.some(cite=>cite.segment_id===id && cite.quote===quote))) throw Error('Exercise instruction lacks evidence');
      return {instruction_segment_id:id,instruction_quote:quote,start:segments[id].start,claims};
    })}));
    const glossary=list(materials.glossary).map(item=>({term:claim(item.term),definition:claim(item.definition)}));
    const rawTerms=list(value.terminology);
    const invalidTerms=rawTerms.filter(item=>typeof item.term !== 'string' || !item.term.trim() || !Array.isArray(item.citations) || !item.citations.length || !item.citations.some(c=>typeof c.quote==='string' && c.quote.includes(item.term)) || item.citations.some(c=>uncertain.has(c.segment_id)));
    if (invalidTerms.length) throw Error('Unanchored terminology: use the exact spoken form in its quotation; omit terms supported only by flagged segments: '+JSON.stringify(invalidTerms.map(item=>({term:item.term,segments:item.citations?.map(c=>c.segment_id)}))).slice(0,2000));
    const terminology=rawTerms.map(item=>{
      if (typeof item.term !== 'string' || !item.term.trim() || !list(item.citations).length || !item.citations.some(c=>typeof c.quote==='string' && c.quote.includes(item.term))) throw Error('Unanchored terminology');
      const evidence = claim({text:item.term,citations:item.citations,rationale:'Exact source terminology',checks:fidelityChecks});
      return {term:item.term,citations:evidence.citations};
    });
    Object.assign(result,{format_version:EDITORIAL_VERSION,materials:{notes,exercises,glossary},source_coverage:coverage,terminology,limitations:list(value.limitations).map(interval)});
  }
  if(value.presentation!==undefined){
    if(value.presentation?.version!==reportFormat.version)throw Error('Unknown presentation format');
    if(!Array.isArray(value.presentation.tags))throw Error('Missing presentation tags');
    result.presentation={version:reportFormat.version,title:claim(value.presentation.title),subtitle:claim(value.presentation.subtitle),tags:value.presentation.tags.map(x=>claim(x))};
    result.limitations=result.limitations.map((x,i)=>({...x,reader_text:validateReaderLimitation(value.limitations[i].reader_text)}));
    for(const span of result.source_coverage.filter(x=>x.disposition==='uncertain'))for(let id=span.first;id<=span.last;id++)if(!result.limitations.some(x=>x.first<=id&&x.last>=id))throw Error('Uncertain source needs a reader-facing limitation');
    validateReportFormat(editorialContent({...result,segments}));
  }
  return result;
}

export async function validateOrRepairEditorial(value, transcript, flags, repair, requireArchive = false) {
  const validate = data => {
    if (requireArchive && data?.format_version !== EDITORIAL_VERSION) throw Error('Require archive-skill-v2 format');
    if (requireArchive && data?.presentation?.version !== reportFormat.version) throw Error('Require presentation '+reportFormat.version);
    // This optional ledger is private. Omit an inflected label absent from
    // its quotes instead of regenerating every chapter to correct one word.
    if (Array.isArray(data?.terminology)) {
      const terminology = data.terminology.filter(entry =>
        typeof entry?.term !== 'string' || !Array.isArray(entry.citations) ||
        !entry.citations.length || !entry.citations.every(c => typeof c?.quote === 'string') ||
        entry.citations.some(c => c.quote.includes(entry.term)));
      data = {...data, terminology};
    }
    if (data?.presentation && Array.isArray(data.source_coverage) && Array.isArray(data.limitations)) {
      const limitations=[...data.limitations];
      for (const span of data.source_coverage) {
        if (span?.disposition!=='uncertain' || !Number.isInteger(span.first) || !Number.isInteger(span.last) ||
            span.first<0 || span.last>=transcript.segments.length) continue;
        let start=null;
        for (let id=span.first;id<=span.last+1;id++) {
          const missing=id<=span.last && !data.limitations.some(range=>range?.first<=id && range?.last>=id);
          if (missing && start===null) start=id;
          if (!missing && start!==null) {
            limitations.push({first:start,last:id-1,reason:span.reason,reader_text:'В этой части записи не удалось уверенно восстановить сказанное.'});
            start=null;
          }
        }
      }
      data={...data,limitations};
    }
    return validateEditorial(data,transcript,flags);
  };
  try { return validate(value); }
  catch (error) { return validate(await repair(error.message)); }
}

export async function repairDraftQuotes(draft, segments, flags, ask) {
  const uncertain = new Set(flags.map(flag => flag.segment_id));
  const result = structuredClone(draft);
  const problems = [];
  const replacements = [];
  function inspect(node, first = 0, last = segments.length - 1) {
    if (!node || typeof node !== 'object') return;
    if (Number.isInteger(node.first) && Number.isInteger(node.last)) { first = node.first; last = node.last; }
    if (Array.isArray(node.citations)) {
      node.citations.forEach((citation, index) => {
        const id = citation?.segment_id;
        if (!Number.isInteger(id) || !segments[id] || typeof citation.quote !== 'string') return;
        if (id >= first && id <= last && citation.quote.trim() && segments[id].text.includes(citation.quote) && !uncertain.has(id)) return;
        const sources = segments.slice(Math.max(first,id-1),Math.min(last+1,id+2)).filter(s => !uncertain.has(s.id));
        problems.push({claim:node.text ?? node.term, citation, sources});
        replacements.push({citations:node.citations,index});
      });
    }
    for (const child of Object.values(node)) inspect(child, first, last);
  }
  inspect(result);
  if (!problems.length) return result;
  const answer = await ask(problems);
  if (!Array.isArray(answer?.citations) || answer.citations.length !== problems.length) throw Error('Incomplete citation correction');
  for (const [i, replacement] of answer.citations.entries()) {
    const source = problems[i].sources.find(s => s.id === replacement?.segment_id);
    if (!source || typeof replacement.quote !== 'string' || !replacement.quote.trim() || !source.text.includes(replacement.quote)) throw Error('Unsupported citation correction');
    replacements[i].citations[replacements[i].index] = {segment_id:source.id, quote:replacement.quote};
  }
  return result;
}

export async function modelJson({ model, key, instructions, input, signal, fetcher = fetch, format = {type:'json_object'}, maxOutputTokens = 24000 }) {
  const options = {
    method:'POST', signal:AbortSignal.any([AbortSignal.timeout(300000), ...(signal ? [signal] : [])]),
    headers:{ Authorization:`Bearer ${key}`, 'Content-Type':'application/json' },
    body:JSON.stringify({ model, store:false, stream:true, instructions, input:'Input data (JSON):\n'+JSON.stringify(input), max_output_tokens:maxOutputTokens, text:{format} })
  };
  let response;
  try { response=await fetcher('https://api.openai.com/v1/responses',options); }
  catch (error) {
    // Undici documents this as failure to establish the socket: no HTTP request
    // was sent. Never retry socket resets, header timeouts, HTTP errors or SSE.
    if (error.cause?.code !== 'UND_ERR_CONNECT_TIMEOUT' || options.signal.aborted) throw error;
    await new Promise(resolve=>setTimeout(resolve,1000));
    response=await fetcher('https://api.openai.com/v1/responses',options);
  }
  if (!response.ok) throw Error(`OpenAI request failed (${response.status})`);
  const body = response.headers?.get('content-type')?.includes('text/event-stream') ? await completedResponse(response.body) : await response.json();
  if (body.status !== 'completed') throw Error('Incomplete model response: '+String(body.incomplete_details?.reason || body.error?.code || body.status).slice(0,100));
  const text = body.output?.flatMap(item => item.content ?? []).filter(c => c.type === 'output_text').map(c => c.text).join('');
  if (!text || text.length > 250000) throw Error('Invalid model output');
  return { value:JSON.parse(text), usage:body.usage, responseId:body.id };
}

async function completedResponse(stream) {
  if (!stream) throw Error('Missing model stream');
  const decoder=new TextDecoder();let buffer='',bytes=0;
  for await (const chunk of stream) {
    bytes+=chunk.byteLength;
    if (bytes>10_000_000) throw Error('Model stream exceeds limit');
    buffer+=decoder.decode(chunk,{stream:true});
    let boundary;
    while ((boundary=/\r?\n\r?\n/.exec(buffer))) {
      const block=buffer.slice(0,boundary.index);buffer=buffer.slice(boundary.index+boundary[0].length);
      const data=block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
      if (!data || data==='[DONE]') continue;
      const event=JSON.parse(data);
      if (event.type==='response.completed') return event.response;
      if (event.type==='response.failed' || event.type==='response.incomplete') return event.response ?? {status:event.type};
      if (event.type==='error') throw Error('Model stream error: '+String(event.code || 'unknown').slice(0,100));
    }
  }
  throw Error('Model stream ended without completion');
}

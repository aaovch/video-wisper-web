// Each saved section is independently readable. Its time and evidence always
// come from the transcript, including when the full editorial pass fails.
export const sectionFormat = {
  type:'json_schema',name:'draft_section',strict:true,
  schema:{type:'object',additionalProperties:false,required:['title','points'],properties:{
    title:{type:'string'},points:{type:'array',items:{
      type:'object',additionalProperties:false,required:['text','segment_id','quote'],
      properties:{text:{type:'string'},segment_id:{type:'integer'},quote:{type:'string'}}
    }}
  }}
};
export function* sectionRanges(segments) {
  let first = 0, length = 0;
  for (const segment of segments) {
    if (segment.id > first && (length + segment.text.length > 10000 || segment.start - segments[first].start >= 480)) {
      yield [first, segment.id - 1];
      first = segment.id;
      length = 0;
    }
    length += segment.text.length;
  }
  if (segments.length) yield [first, segments.length - 1];
}

export function checkedSection(value, segments, first, last, flags) {
  const excluded = new Set(flags.map(flag => flag.segment_id));
  if (!Array.isArray(value?.points) || value.points.length > 5) throw Error('Invalid draft points');
  const points = value.points.map(point => {
    const id = point?.segment_id;
    if (!Number.isInteger(id) || id < first || id > last || excluded.has(id) ||
        typeof point.text !== 'string' || !point.text.trim() || point.text.length > 600 ||
        typeof point.quote !== 'string' || !point.quote.trim() || !segments[id].text.includes(point.quote)) throw Error('Invalid draft evidence');
    return {text:point.text.trim(),segment_id:id,quote:point.quote};
  });
  if (typeof value.title !== 'string' || value.title.length > 180 || (points.length && !value.title.trim())) throw Error('Invalid draft title');
  return {first,last,title:value.title.trim(),points};
}

export async function prepareSections(checkpoint, saved, generate, persist) {
  const {segments,flags} = checkpoint;
  for (const [first,last] of sectionRanges(segments)) {
    if (saved.some(section => section.first===first && section.last===last)) continue;
    const input = {segments:segments.slice(first,last+1),flags:flags.filter(flag=>flag.segment_id>=first && flag.segment_id<=last)};
    let section;
    for (let attempt=0; attempt<2; attempt++) {
      try {
        const result = await generate(input,first,attempt);
        section = checkedSection(result,segments,first,last,flags);
        break;
      } catch (error) {
        if (error.name==='AbortError' || error.message==='Worker lease lost') throw error;
        // Retry a malformed answer once. An infrastructure failure can be
        // ambiguous, so leave that section for the next leased attempt.
        if (!['Invalid draft evidence','Invalid draft points','Invalid draft title'].includes(error.message)) return;
        input.correction = error.message;
      }
    }
    if (section) await persist(section);
  }
}

// Standard API rates checked 2026-11-06. Store the estimate with the finished job.
// https://developers.openai.com/api/docs/models/gpt-6.1-terra
// https://developers.openai.com/api/docs/models/whisper-1
export const whisperUsdPerMinute = 0.006;

export function estimateProcessingRangeUsd(duration, model, responses) {
  if (!Number.isFinite(duration) || duration <= 0 || model !== 'gpt-6.1-terra' || !responses.size) return null;
  let usd = duration / 60 * whisperUsdPerMinute;
  let uncertainty = 0;
  for (const response of responses.values()) {
    const usage = response.usage;
    const details = usage?.input_tokens_details ?? {};
    const cached = details.cached_tokens ?? 0;
    const writes30m = details.cache_write_tokens_details?.ttl_30m_tokens ?? 0;
    const writes12h = details.cache_write_tokens_details?.ttl_12h_tokens ?? 0;
    const writes = details.cache_write_tokens ?? writes30m + writes12h;
    const unknown = writes - writes30m - writes12h;
    const ordinary = usage?.input_tokens - cached - writes;
    const output = usage?.output_tokens;
    if (![ordinary, cached, writes30m, writes12h, unknown, output].every(n => Number.isSafeInteger(n) && n >= 0)) return null;
    const long = usage.input_tokens > 272000;
    uncertainty += unknown * (2.5 - 1.25) * (long ? 2 : 1) / 1e6;
    usd += ((ordinary + cached * .05 + (writes30m + unknown) * 1.25 + writes12h * 2.5) * (long ? 2 : 1)
      + output * 5 * (long ? 1.5 : 1)) / 1e6;
  }
  return [usd, usd + uncertainty];
}

export function estimateProcessingUsd(duration, model, responses) {
  const range=estimateProcessingRangeUsd(duration,model,responses);
  return range && range[0]===range[1] ? range[0] : null;
}

import MiniSearch from 'minisearch';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { normalizeCollections, isPrivateReport, resolveReportGate } from '../src/lib/data/report-access.js';
import { publicPreviewDocument } from '../src/lib/data/report-preview.js';
import { searchIndexOptions } from '../src/lib/search-index-schema.js';
import { packSearchIndex } from '../src/lib/search-index-codec.js';
import { OWNER_SCOPE } from './access-policy.mjs';

export function buildPrivateIndexes(dir, rows, docs, titles, summaries) {
  const collections = normalizeCollections(rows);
  for (const c of collections) if (c.private && !c.access?.master) throw Error('Private collection requires a master scope: ' + c.slug);
  const scopes = new Set(collections.flatMap(c => [c.access?.master, ...(c.access?.passes ?? [])]).filter(Boolean).map(t => t.id));
  scopes.add(OWNER_SCOPE);
  const gates = new Map(Object.keys(titles).map(slug => [slug, resolveReportGate(slug, collections).map(t => t.id)]));
  const previews = summaries.filter(report => !isPrivateReport(report.slug, collections)).map(publicPreviewDocument);
  // Multi-key sessions extend the public index with each permitted recording once.
  const additions = join(dir, 'recordings');
  mkdirSync(additions, {recursive:true});
  for (const [slug, required] of gates) {
    if (!required.length) continue;
    const recording = docs.filter(doc => doc.reportSlug === slug);
    for (const [name, transcript] of [['core',false],['transcripts',true]]) {
      writeFileSync(join(additions, slug + '.' + name + '.json.gz'),
        gzipSync(JSON.stringify(recording.filter(doc => (doc.kind === 'transcript') === transcript))));
    }
  }
  for (const scope of [null, ...scopes]) {
    const allowed = slug => gates.has(slug) && (scope === OWNER_SCOPE || !gates.get(slug).length || gates.get(slug).includes(scope));
    const subset = [...docs.filter(doc => allowed(doc.reportSlug)), ...previews.filter(doc => !allowed(doc.reportSlug))];
    const folder = join(dir, scope ? Buffer.from(scope).toString('base64url') : 'public');
    mkdirSync(folder, {recursive:true});
    for (const [name, transcript] of [['index-core',false],['index-transcripts',true]]) {
      const index = new MiniSearch(searchIndexOptions);
      index.addAll(subset.filter(doc => (doc.kind === 'transcript') === transcript));
      writeFileSync(join(folder, name + '.json.gz'), gzipSync(JSON.stringify(index)));
      writeFileSync(join(folder, name + '.compact.json.gz'), gzipSync(JSON.stringify(packSearchIndex(index.toJSON()))));
    }
    writeFileSync(join(folder,'chapter-titles.json.gz'), gzipSync(JSON.stringify(Object.fromEntries(Object.entries(titles).filter(([slug]) => allowed(slug))))));
  }
}

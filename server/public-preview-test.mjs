import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import MiniSearch from 'minisearch';
import { openAccessStore } from './access-store.mjs';
import { siteServer } from './site.mjs';
import { searchIndexOptions } from '../src/lib/search-index-schema.js';
import { publicReportPreview } from '../src/lib/data/report-preview.js';

const read = name => JSON.parse(readFileSync(new URL('../src/lib/data/' + name + '.json', import.meta.url), 'utf8'));
import { normalizeCollections } from '../src/lib/data/report-access.js';
const collections = normalizeCollections(read('collections'));

test('public synopses, internal meetings and mixed video/collection keys enforce the same boundaries', async t => {
  const store = openAccessStore(':memory:');
  const server = siteServer(store, 'https://hema-archive.com').listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.close(); store.close(); });
  const call = (path, cookie = '', body) => new Promise((resolve, reject) => {
    const req = request({hostname:'127.0.0.1', port:server.address().port, path, method:body ? 'POST' : 'GET',
      headers:{host:'hema-archive.com', origin:'https://hema-archive.com', cookie}}, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c)).on('end', () => {
        const raw = Buffer.concat(chunks);
        resolve({status:res.statusCode, headers:res.headers, raw:res.headers['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw});
      });
    }); req.on('error', reject).end(body);
  });
  const json = async (path, cookie) => JSON.parse((await call(path,cookie)).raw);
  const bootstrap = async (path, cookie) => JSON.parse((await call(path,cookie)).raw.toString().match(/globalThis\.__hema=(.*?)<\/script>/s)[1]);
  const login = async (scope, targets = [scope]) => {
    const body = new URLSearchParams({key:store.issue(scope)});
    for(const target of targets)body.append('target',target);
    const result = await call('/api/login','',body.toString());
    assert.equal(result.status,204);
    return result.headers['set-cookie'][0].split(';')[0];
  };
  const seminar = collections.find(c => c.slug === 'seminary-kashitsina');
  const slug = 'rapira-rabota-v-soedinenii-kashitsin';
  const original = read('reports/' + slug);
  const preview = await json('/api/reports/' + slug);
  assert.deepEqual(preview, {...publicReportPreview(original,collections),chapters:[],tags:[]});
  for(const field of ['video','source_url','source_name','source_stem','has_transcript','materials','note'])assert.equal(field in preview,false,field);
  assert.ok(preview.overview_theses.length);
  assert.equal(preview.preview.exerciseCount,(original.materials?.exercises ?? original.seminar_exercises ?? []).reduce((n,s) => n+s.items.length,0));
  assert.equal(preview.chapterCount,original.chapters.length);
  assert.equal(preview.preview.topics.length,3);
  for(const topic of preview.preview.topics)assert.ok(original.chapters.some(c=>c.title===topic));
  const guest = await bootstrap('/collections/seminary-kashitsina/');
  assert.deepEqual(guest.reports.find(r => r.slug === slug).overview_theses,read('report-meta').find(r => r.slug === slug).overview_theses);
  assert.equal((await call('/transcripts/' + slug + '.json')).status,403);

  const privateCollections = collections.filter(c => c.private);
  assert.ok(privateCollections.some(c => c.slug === 'sobraniya-core-noname'));
  const guestHTML = (await call('/')).raw.toString();
  const guestTitles = await json('/search/chapter-titles.json');
  const guestCore = await json('/search/index-core.json');
  const guestTranscript = await json('/search/index-transcripts.json');
  for(const c of privateCollections) {
    assert.equal(guest.collections.find(x => x.slug === c.slug).description,undefined);
    for(const internalSlug of c.items) {
      const internal = read('reports/' + internalSlug);
      const response = await json('/api/reports/' + internalSlug);
      assert.equal(response.title,'Закрытая запись');
      assert.deepEqual(response.overview_theses,[]);
      assert.equal('preview' in response,false);
      assert.ok(!guestHTML.includes(internal.title));
      for(const text of internal.overview_theses)assert.ok(!guestHTML.includes(text));
      assert.equal(guestTitles[internalSlug],undefined);
      for(const index of [guestCore,guestTranscript])assert.ok(!Object.values(index.storedFields).some(d => d.reportSlug === internalSlug));
      assert.equal((await call('/transcripts/' + internalSlug + '.json')).status,403);
      const head = (await call('/reports/' + internalSlug + '/')).raw.toString().split('</head>')[0];
      assert.ok(!head.includes(internal.title));
    }
  }
  const docs = Object.values(guestCore.storedFields).filter(d => d.reportSlug === slug);
  assert.equal(docs.length,1);assert.equal(docs[0].kind,'report');
  const summary = read('report-meta').find(report => report.slug === slug);
  assert.equal(docs[0].text, [summary.subtitle, ...summary.overview_theses].filter(Boolean).join(' '));
  assert.equal(guestTitles[slug],undefined);

  const videoCookie = await login('report:' + slug, seminar.access.passes.map(p => p.id));
  const masterCookie = await login('hema-theory');
  assert.equal((await call('/transcripts/metodichka.json',masterCookie)).status,200);
  for(const reportSlug of seminar.items) {
    assert.equal((await call('/transcripts/' + reportSlug + '.json',videoCookie)).status,reportSlug === slug ? 200 : 403);
    assert.equal((await call('/transcripts/' + reportSlug + '.json',masterCookie)).status,403);
  }
  assert.deepEqual(await json('/api/reports/' + slug,videoCookie),original);
  for(const c of privateCollections) {
    const cookie = await login(c.access.master.id);
    for(const reportSlug of c.items)assert.deepEqual(await json('/api/reports/' + reportSlug,cookie),read('reports/' + reportSlug));
    assert.equal((await call('/transcripts/' + slug + '.json',cookie)).status,403);
  }
  // Multiple grants start from public previews, then replace authorized previews once.
  const otherSlug = 'sablya-oruzhie-v-liniyu-kashitsin';
  const other = await login('report:' + otherSlug);
  const mixed = videoCookie + '; ' + other;
  const index = MiniSearch.loadJS(await json('/search/index-core.json',mixed), searchIndexOptions);
  for(const recording of await json('/search/extra-core.json',mixed)) {
    for(const doc of recording){const id='preview:' + doc.reportSlug;if(doc.id!==id && index.has(id))index.discard(id);}
    index.addAll(recording);
  }
  for(const reportSlug of [slug,otherSlug]) {
    assert.equal(index.has('preview:' + reportSlug),false);
    assert.equal((await call('/transcripts/' + reportSlug + '.json',mixed)).status,200);
  }
  assert.equal(index.has('preview:metodichka'),true);
  for(const c of privateCollections)for(const reportSlug of c.items)assert.equal((await call('/transcripts/' + reportSlug + '.json',mixed)).status,403);
  store.revoke('report:' + slug);
  assert.equal((await call('/transcripts/' + slug + '.json',mixed)).status,403);
  assert.equal((await call('/transcripts/' + otherSlug + '.json',mixed)).status,200);
});

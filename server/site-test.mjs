import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { openAccessStore } from './access-store.mjs';
import { siteServer } from './site.mjs';
import { unpackSearchIndex, SEARCH_INDEX_MEDIA_TYPE } from '../src/lib/search-index-codec.js';
import { readFileSync, readdirSync } from 'node:fs';

test('the server search worker does not embed static report summaries', () => {
  const directory = new URL('../.codex/server-ui/_app/immutable/workers/',import.meta.url);
  const bundles = readdirSync(directory).filter(name => /^search\.worker-.*\.js$/.test(name));
  assert.equal(bundles.length,1);
  const bundle = readFileSync(new URL(bundles[0],directory),'utf8');
  const reports = JSON.parse(readFileSync(new URL('../src/lib/data/report-meta.json',import.meta.url),'utf8'));
  const theses = reports.flatMap(report => report.overview_theses ?? []).filter(text => text.length > 60);
  assert.ok(theses.length > 0);
  for (const text of theses) assert.ok(!bundle.includes(text),'Static report text must not be embedded in the server worker');
});

test('production pages, transcript index, direct attachments and range reads enforce the same grants', async t => {
  const store = openAccessStore(':memory:');
  const origin = 'https://hema-archive.com';
  const server = siteServer(store, origin).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(() => { server.close(); store.close(); });
  const call = (path, cookie = '', body, headers = {}) => new Promise((resolve,reject) => {
    const req = request({hostname:'127.0.0.1',port:server.address().port,path,method:body ? 'POST' : 'GET',
      headers:{host:'hema-archive.com',origin,cookie,...headers}}, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk)).on('end',() => {
        const raw = Buffer.concat(chunks);
        resolve({status:res.statusCode, headers:res.headers, raw:res.headers['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw});
      });
    });
    req.on('error',reject).end(body);
  });
  const scope = 'hema-theory';
  const visit = slug => JSON.stringify({slug});
  assert.equal((await call('/api/visits', '', visit('metodichka'))).status,403);
  assert.equal((await call('/api/visits', '', visit('unknown'))).status,400);
  assert.equal((await call('/api/visits', '', visit('sablya-8'), {origin:'https://example.com'})).status,403);
  const tracked = await call('/api/visits', '', visit('sablya-8'));
  assert.equal(tracked.status,204);
  const visitor = tracked.headers['set-cookie'][0].split(';')[0];
  assert.equal((await call('/api/visits', visitor, visit('sablya-8'))).status,204);
  assert.equal((await call('/api/visits', '', visit('sablya-8'), {'user-agent':'ExampleBot'})).status,204);
  for (const agent of ['Chrome-Lighthouse', 'SecurityScanner', 'curl/8.0', 'python-requests/2.0']) {
    assert.equal((await call('/api/visits', '', visit('sablya-8'), {'user-agent':agent})).status,204);
  }
  const stats = JSON.parse((await call('/api/statistics')).raw);
  assert.equal(stats.rows.find(row => row.slug === 'sablya-8').visits,1);
  assert.equal((await call('/api/statistics/preference?excluded=1', '', 'set', {origin:'https://example.com'})).status,403);
  const exclude = await call('/api/statistics/preference?excluded=1', '', 'set');
  assert.equal(exclude.status,200);
  const exclusion = exclude.headers['set-cookie'][0].split(';')[0];
  assert.equal(JSON.parse((await call('/api/statistics/preference',exclusion)).raw).excluded,true);
  await call('/api/visits',exclusion,visit('sablya-8'));
  assert.equal(JSON.parse((await call('/api/statistics')).raw).rows.find(row => row.slug === 'sablya-8').visits,1);
  const enable = await call('/api/statistics/preference?excluded=0',exclusion,'set');
  assert.match(enable.headers['set-cookie'][0],/Max-Age=0/);
  await call('/api/visits','',visit('sablya-8'));
  assert.equal(JSON.parse((await call('/api/statistics')).raw).rows.find(row => row.slug === 'sablya-8').visits,2);
  const key = store.issue(scope);
  const response = await call('/api/login','',new URLSearchParams({key,target:scope}).toString());
  assert.equal(response.status,204);
  const cookie = response.headers['set-cookie'][0].split(';')[0];
  for (const [session,expected] of [['',403],[cookie,200]]) {
    for (const path of ['/transcripts/metodichka.json','/transcripts/metodichka.chapters.json','/media/metodichka.jpg']) {
      assert.equal((await call(path,session)).status,expected);
    }
    const video = await call('/media/metodichka.mp4',session,undefined,{range:'bytes=0-15'});
    assert.equal(video.status,session ? 206 : 403);
    if (session) assert.equal(video.raw.length,16);
    assert.equal((await call('/transcripts/sablya-8.json',session)).status,200);
    const report = JSON.parse((await call('/api/reports/metodichka',session)).raw);
    assert.equal(report.chapters.length > 0,Boolean(session));
    for (const shard of ['index-core','index-transcripts']) {
      const index = JSON.parse((await call('/search/' + shard + '.json',session)).raw);
      const docs = Object.values(index.storedFields);
      assert.ok(docs.some(doc => doc.reportSlug === 'sablya-8'));
      assert.equal(docs.some(doc => doc.reportSlug === 'metodichka' && doc.kind !== 'report'),Boolean(session));
      assert.ok(!docs.some(doc => doc.reportSlug === 'prostaya-ataka-mikrotsikl-1-dlinnyy-mech' && doc.kind !== 'report'));
      const compact = await call('/search/' + shard + '.json',session,undefined,{accept:SEARCH_INDEX_MEDIA_TYPE});
      assert.equal(compact.headers['content-type'],SEARCH_INDEX_MEDIA_TYPE);
      assert.equal(compact.headers['cache-control'],'private, no-store');
      assert.equal(compact.headers.vary,'Accept');
      assert.deepEqual(unpackSearchIndex(JSON.parse(compact.raw)),index);
    }
  }
  const guestDocs = Object.values(JSON.parse((await call('/search/index-core.json')).raw).storedFields);
  assert.deepEqual(guestDocs.filter(d => d.reportSlug === 'metodichka').map(d => d.kind), ['report']);
  assert.equal((await call('/api/login','',new URLSearchParams({key,target:'noname'}).toString())).status,403);
  assert.equal((await call('/.codex/private-index/public/index-core.json.gz')).status,404);
  store.revoke(scope);
  assert.equal((await call('/media/metodichka.jpg',cookie)).status,403);

  const sabre = 'sablya-oruzhie-v-liniyu-kashitsin';
  const rapier = 'rapira-rabota-v-soedinenii-kashitsin';
  const loginRecording = async (slug, previous = '') => {
    const target = 'report:' + slug;
    const login = await call('/api/login',previous,new URLSearchParams({key:store.issue(target), target}).toString());
    assert.equal(login.status,204);
    return login.headers['set-cookie'][0].split(';')[0];
  };
  const first = await loginRecording(sabre);
  const second = await loginRecording(rapier,first);
  const both = first + '; ' + second;
  for (const shard of ['core','transcripts']) {
    const docs = JSON.parse((await call('/search/extra-' + shard + '.json',both)).raw).flat();
    assert.deepEqual(new Set(docs.map(doc => doc.reportSlug)),new Set([sabre,rapier]));
    assert.equal(new Set(docs.map(doc => doc.id)).size,docs.length);
    assert.equal((await call('/search/index-' + shard + '.json',both)).headers['x-archive-search-extras'],'1');
    const compact = await call('/search/index-' + shard + '.json',both,undefined,{accept:SEARCH_INDEX_MEDIA_TYPE});
    assert.equal(compact.headers['x-archive-search-extras'],'1');
    assert.deepEqual(unpackSearchIndex(JSON.parse(compact.raw)),JSON.parse((await call('/search/index-' + shard + '.json',both)).raw));
  }
  store.revoke('report:' + sabre);
  assert.equal((await call('/transcripts/' + sabre + '.json',both)).status,403);
  assert.equal((await call('/transcripts/' + rapier + '.json',both)).status,200);
  await call('/api/logout',both,'logout');
  assert.equal((await call('/transcripts/' + rapier + '.json',both)).status,403);
});

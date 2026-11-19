import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { once } from 'node:events';
import { archiveServer } from './archive.mjs';
import { openAccessStore } from './access-store.mjs';

test('anonymous requests, scoped sessions and revocation across report, transcript and search', async t => {
  const store = openAccessStore(':memory:');
  const origin = 'http://127.0.0.1:4185';
  const server = archiveServer(store, origin);
  server.listen(0,'127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.close(); store.close(); });
  const call = (path, cookie = '', body, requestOrigin = origin) => new Promise((resolve, reject) => {
    const req = request({hostname:'127.0.0.1', port:server.address().port, path, method:body === undefined ? 'GET' : 'POST',
      headers:{Host:new URL(origin).host, Origin:requestOrigin, Cookie:cookie}}, res => {
      let text = '';
      res.setEncoding('utf8').on('data', chunk => text += chunk).on('end', () => resolve({status:res.statusCode, text, headers:res.headers}));
    });
    req.on('error', reject).end(body);
  });
  const report = '/reports/prostaya-ataka-mikrotsikl-1-dlinnyy-mech/';
  const transcript = report.replace('/reports/', '/transcripts/');
  assert.equal((await call('/reports/sablya-8/')).status, 200);
  for (const path of [report, transcript]) assert.equal((await call(path, 'hema_local_session=noname-training')).status, 403);
  for (const path of ['/static/search/index-core.json','/search/index-core.json','/src/lib/data/collections.json','/media/metodichka.mp4']) {
    assert.equal((await call(path)).status, 404);
  }
  const key = store.issue('noname-training:longsword-cycles');
  assert.equal((await call('/login', '', 'key=' + key, 'https://example.org')).status, 403);
  assert.equal((await call('/login', '', 'key=noname-training')).status, 403);
  const response = await call('/login', '', 'key=' + key);
  assert.equal(response.status, 303);
  const header = response.headers['set-cookie'][0];
  assert.match(header, /HttpOnly/);
  const cookie = header.split(';')[0];
  assert.equal((await call(report, cookie)).status, 200);
  assert.equal((await call(transcript, cookie)).status, 200);
  assert.equal((await call('/reports/mech-i-bakler-mikrotsikl-1-osnovy/', cookie)).status, 403);
  const query = '/?q=' + encodeURIComponent('простая атака');
  assert.ok((await call(query, cookie)).text.includes(report));
  assert.ok(!(await call(query)).text.includes(report));
  store.revoke('noname-training:longsword-cycles');
  assert.equal((await call(report, cookie)).status, 403);
  assert.equal((await call('/login', '', 'key=' + key)).status, 403);
});

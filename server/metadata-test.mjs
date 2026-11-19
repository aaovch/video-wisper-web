import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import test from 'node:test';
import { pageMetadata } from './metadata.mjs';
import { openAccessStore } from './access-store.mjs';
import { siteServer } from './site.mjs';

test('metadata escapes text, strips query secrets and omits private summaries', () => {
  const reports = [{slug:'private', title:'A < B & "C"', subtitle:'SECRET'}, {slug:'public', title:'Open', subtitle:'Public description'}];
  const origin = 'https://hema-archive.com/?key=secret#time';
  const privateHead = pageMetadata('/reports/private', origin, [], reports, slug => slug === 'public');
  assert.match(privateHead, /A &lt; B &amp; &quot;C&quot;/);
  assert.match(privateHead, /name="robots" content="noindex"/);
  assert.doesNotMatch(privateHead, /SECRET|key=|#time/);
  assert.match(privateHead, /href="https:\/\/hema-archive.com\/reports\/private\/"/);
  const publicHead = pageMetadata('/reports/public/', origin, [], reports, () => true);
  assert.match(publicHead, /Public description/);
  assert.doesNotMatch(publicHead, /noindex/);
  assert.equal(pageMetadata('/reports/missing/', origin, [], reports, () => true), null);
});

test('HTTP responses expose current branding, page metadata and public assets without JavaScript', async t => {
  const store = openAccessStore(':memory:');
  const server = siteServer(store, 'https://hema-archive.com').listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.close(); store.close(); });
  const get = (path, method = 'GET') => new Promise((resolve, reject) => {
    const req = request({hostname:'127.0.0.1', port:server.address().port, path, method, headers:{host:'hema-archive.com'}}, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk)).on('end', () => resolve({status:res.statusCode, headers:res.headers, raw:Buffer.concat(chunks)}));
    });
    req.on('error', reject).end();
  });
  const home = await get('/?key=secret&t=20');
  const head = home.raw.toString().split('</head>')[0];
  assert.equal(home.status, 200);
  assert.match(head, /<title[^>]*>HEMA-архив — Видео об историческом фехтовании<\/title>/);
  assert.match(head, /property="og:image" content="https:\/\/hema-archive.com\/social-preview-v1.png"/);
  assert.doesNotMatch(head, /личный архив|key=secret|[?&]t=20/);
  assert.equal((head.match(/<title\b/g) ?? []).length, 1);
  const report = (await get('/reports/sablya-8/')).raw.toString().split('</head>')[0];
  assert.match(report, /property="og:type" content="article"/);
  assert.match(report, /property="og:url" content="https:\/\/hema-archive.com\/reports\/sablya-8\/"/);
  const privateHead = (await get('/reports/metodichka/')).raw.toString().split('</head>')[0];
  assert.match(privateHead, /name="robots" content="noindex"/);
  assert.match((await get('/stats/')).raw.toString(), /name="robots" content="noindex"/);
  assert.equal((await get('/reports/missing-metadata-test/')).status, 404);
  assert.equal((await get('/collections/missing-metadata-test/')).status, 404);
  for (const [path, type] of [['/favicon.svg','image/svg+xml'], ['/favicon.ico','image/x-icon'], ['/favicon-32x32.png','image/png'],
    ['/apple-touch-icon.png','image/png'], ['/icon-192.png','image/png'], ['/icon-512.png','image/png'],
    ['/social-preview-v1.png','image/png'], ['/site.webmanifest','application/manifest+json']]) {
    const asset = await get(path);
    assert.equal(asset.status, 200, path);
    assert.equal(asset.headers['content-type'], type);
    const headResponse = await get(path, 'HEAD');
    assert.equal(headResponse.raw.length, 0);
    assert.equal(Number(headResponse.headers['content-length']), asset.raw.length);
  }
  const stats = (await get('/stats/')).raw.toString();
  const recording = (await get('/reports/sablya-8/')).raw.toString();
  for (const html of [stats, recording]) {
    assert.match(html, /<body data-page-catalog/);
    assert.ok(Buffer.byteLength(html) < home.raw.length);
    const catalog = JSON.parse(html.match(/globalThis\.__hema=(.*?)<\/script>/s)[1]);
    assert.ok(catalog.reports.length > 0);
    assert.ok(catalog.reports.every(r => r.slug && r.title && !('overview_theses' in r)));
  }
  const png = (await get('/social-preview-v1.png')).raw;
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.match((await get('/robots.txt')).raw.toString(), /Sitemap: https:\/\/hema-archive.com\/sitemap.xml/);
  const xml = (await get('/sitemap.xml')).raw.toString();
  assert.match(xml, /https:\/\/hema-archive.com\/reports\/sablya-8\//);
  assert.doesNotMatch(xml, /\/reports\/metodichka\/|\/stats\//);
});

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { openAccessStore } from './access-store.mjs';
import { siteServer } from './site.mjs';
import { OWNER_SCOPE } from './access-policy.mjs';

test('a personal owner key unlocks every recording and full search, persists on its device and revokes independently', async t => {
  const store = openAccessStore(':memory:');
  const origin = 'https://hema-archive.com';
  const server = siteServer(store,origin).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(() => { server.close(); store.close(); });
  const call = (path,cookie='',body) => new Promise((resolve,reject) => {
    const req = request({hostname:'127.0.0.1',port:server.address().port,path,method:body ? 'POST':'GET',headers:{host:'hema-archive.com',origin,cookie}},res => {
      const chunks=[];res.on('data',c=>chunks.push(c)).on('end',()=>{
        const raw=Buffer.concat(chunks);resolve({status:res.statusCode,headers:res.headers,raw:res.headers['content-encoding']==='gzip'?gunzipSync(raw):raw});
      });
    });req.on('error',reject).end(body);
  });
  const key=store.issue(OWNER_SCOPE);
  const normalKey=store.issue('hema-theory');
  const normalSession=store.login(normalKey,['hema-theory']);
  assert.equal(store.login(normalKey,['report:tsentralnaya-pozitsiya-dlinnyy-mech']),undefined);
  assert.equal((await call('/api/login','',new URLSearchParams({key:'archive:owner',target:'hema-theory'}).toString())).status,403);
  const login=await call('/api/login','',new URLSearchParams({key,target:'report:tsentralnaya-pozitsiya-dlinnyy-mech'}).toString());
  assert.equal(login.status,204);
  const cookie=login.headers['set-cookie'][0].split(';')[0];
  assert.match(login.headers['set-cookie'][0],/HttpOnly; SameSite=Lax; Path=\/; Max-Age=34560000; Secure/);
  const reports=JSON.parse(readFileSync(new URL('../src/lib/data/report-meta.json',import.meta.url),'utf8'));
  for(const {slug} of reports){
    const result=await call('/api/reports/'+slug,cookie);assert.equal(result.status,200,slug);
    assert.deepEqual(JSON.parse(result.raw),JSON.parse(readFileSync(new URL('../src/lib/data/reports/'+slug+'.json',import.meta.url),'utf8')),slug);
  }
  for(const slug of ['tsentralnaya-pozitsiya-dlinnyy-mech','sablya-oruzhie-v-liniyu-kashitsin','metodichka']) {
    assert.equal((await call('/transcripts/'+slug+'.json')).status,403);
    assert.equal((await call('/transcripts/'+slug+'.json',cookie)).status,200);
  }
  assert.equal((await call('/media/metodichka.jpg',cookie)).status,200);
  const normalLogin=await call('/api/login','',new URLSearchParams({key:normalKey,target:'hema-theory'}).toString());
  const both=cookie+'; '+normalLogin.headers['set-cookie'][0].split(';')[0];
  for(const shard of ['index-core','index-transcripts','chapter-titles']) {
    const full=await call('/search/'+shard+'.json',cookie);
    assert.equal(full.status,200);assert.deepEqual((await call('/search/'+shard+'.json',both)).raw,full.raw);
    assert.equal(full.headers['x-archive-search-extras'],undefined);
    if(shard!=='chapter-titles') {
      const docs=Object.values(JSON.parse(full.raw).storedFields);
      for(const slug of ['tsentralnaya-pozitsiya-dlinnyy-mech','sablya-oruzhie-v-liniyu-kashitsin','metodichka','prostaya-ataka-mikrotsikl-1-dlinnyy-mech'])assert(docs.some(d=>d.reportSlug===slug),shard+': '+slug);
    }
  }
  const html=(await call('/',cookie)).raw.toString();
  const bootstrap=JSON.parse(html.match(/globalThis\.__hema=(.*?)<\/script>/s)[1]);
  const collections=JSON.parse(readFileSync(new URL('../src/lib/data/collections.json',import.meta.url),'utf8'));
  const targets=collections.flatMap(c=>[c.access?.master,...(c.access?.passes??[])]).filter(Boolean);
  assert.deepEqual(new Set(bootstrap.unlocked),new Set(targets.map(t=>t.id+'@'+(t.credentialVersion??1))));
  assert(!html.includes(key));assert(!bootstrap.unlocked.includes(OWNER_SCOPE));
  const session=cookie.split('=')[1];store.syncDevice('owner-test-device',[session],86400000);
  const restored=store.syncDevice('owner-test-device',[],86400000);assert.equal(restored.length,1);assert.equal(store.scope(restored[0][1]),OWNER_SCOPE);
  store.revoke(OWNER_SCOPE);
  assert.equal((await call('/transcripts/tsentralnaya-pozitsiya-dlinnyy-mech.json',cookie)).status,403);
  assert.equal(store.scope(restored[0][1]),undefined);
  assert.deepEqual(store.syncDevice('owner-test-device',[],86400000),[]);
  assert.equal(store.scope(normalSession),'hema-theory');
  assert.equal((await call('/transcripts/metodichka.json',normalLogin.headers['set-cookie'][0].split(';')[0])).status,200);
});

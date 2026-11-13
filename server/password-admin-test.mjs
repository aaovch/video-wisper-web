import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { OWNER_SCOPE } from './access-policy.mjs';
import { openAccessStore } from './access-store.mjs';
import { siteServer } from './site.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');

test('only the owner sees and changes archive passwords; changes revoke old access and leave unrelated keys intact', async t => {
  const store = openAccessStore(':memory:');
  const origin = 'https://hema-archive.com';
  const server = siteServer(store,origin).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(() => { server.close(); store.close(); });
  const call = (path,cookie='',body,headers={},method=body===undefined?'GET':'POST') => new Promise((resolve,reject) => {
    const req = request({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{host:'hema-archive.com',origin,cookie,...headers}},res => {
      let text='';res.setEncoding('utf8').on('data',chunk=>text+=chunk).on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));
    });req.on('error',reject).end(body);
  });
  const login = async key => {
    const response = await call('/api/login','',new URLSearchParams({key,target:'hema-theory'}).toString());
    assert.equal(response.status,204);
    return {cookie:response.headers['set-cookie'][0].split(';')[0],response};
  };
  const ownerKey = store.issue(OWNER_SCOPE);
  const old = store.issue('hema-theory');
  const second = store.issue('hema-theory');
  assert.equal(second,old);
  const other = store.issue('report:batmany-na-meche');
  const otherSession = store.login(other,['report:batmany-na-meche']);
  const regular = await login(old);
  const owner = await login(ownerKey);
  assert.equal(owner.response.headers['x-archive-admin'],'/admin/');
  assert.equal(regular.response.headers['x-archive-admin'],undefined);
  const update = (scope,password) => new URLSearchParams({scope,password}).toString();
  for (const cookie of ['',regular.cookie,'__Host-hema_session=archive:owner']) {
    const denied = await call('/admin/',cookie);
    assert.equal(denied.status,403);assert(!denied.text.includes(old));
    assert.equal((await call('/admin/passwords',cookie,update('hema-theory','unauthorized-password'))).status,403);
    assert(!JSON.parse((await call('/',cookie)).text.match(/globalThis\.__hema=(.*?)<\/script>/s)[1]).owner);
  }
  const admin = await call('/admin/',owner.cookie);
  assert.equal(admin.status,200);assert(admin.text.includes(old));assert(admin.text.includes(second));assert(!admin.text.includes(ownerKey));
  assert.equal(admin.headers['cache-control'],'private, no-store');
  assert.equal(admin.headers['x-robots-tag'],'noindex, nofollow');
  assert.equal([...admin.text.matchAll(/data-password-access>/g)].length,2);
  assert.equal([...admin.text.matchAll(/>Скопировать доступ<\/button>/g)].length,2);
  assert(admin.text.includes('data-access-search'));
  assert(admin.text.includes('data-access-filter'));
  assert(!admin.text.includes('class="password-editor" open'));
  assert(admin.text.includes('aria-describedby="title-'));
  assert(admin.text.includes('https://hema-archive.com/collections/hema-theory/'));
  assert(admin.text.includes('https://hema-archive.com/reports/batmany-na-meche/?from=petr-vasilev'));
  assert(admin.text.includes('Пароль: '+old));assert(admin.text.includes('Пароль: '+second));
  assert(JSON.parse((await call('/',owner.cookie)).text.match(/globalThis\.__hema=(.*?)<\/script>/s)[1]).owner);
  assert.equal((await call('/admin/',owner.cookie,undefined,{},'HEAD')).text,'');
  assert.equal((await call('/admin/passwords',owner.cookie)).status,405);
  assert.equal((await call('/admin/passwords',owner.cookie,update('hema-theory','different-password'),{origin:'https://evil.invalid'})).status,403);
  for (const [scope,password] of [['unknown','different-password'],[OWNER_SCOPE,'different-password'],['hema-theory','abc'],['hema-theory','  padded password'],['hema-theory','x'.repeat(9)],['hema-theory',other],['hema-theory',ownerKey]]) {
    assert.equal((await call('/admin/passwords',owner.cookie,update(scope,password))).status,400);
  }
  assert.equal((await call('/admin/passwords',owner.cookie,'x'.repeat(4097))).status,413);
  const invalid=await call('/admin/passwords',owner.cookie,update('hema-theory','abc'));
  assert.equal(invalid.status,400);
  assert.equal([...invalid.text.matchAll(/class="password-editor" open/g)].length,1);
  assert.equal([...invalid.text.matchAll(/aria-invalid="true" autofocus/g)].length,1);
  assert(invalid.text.includes('role="alert"'));
  assert(store.login(old,['hema-theory']));
  const oldSession = regular.cookie.split('=')[1];
  store.syncDevice('password-admin-test',[oldSession],86400000);
  const replacement = '<img&>';
  const saved = await call('/admin/passwords',owner.cookie,update('hema-theory',replacement));
  assert.equal(saved.status,303);assert.equal(saved.headers.location,'/admin/?saved=hema-theory#access-hema-theory');
  assert.equal(store.login(old,['hema-theory']),undefined);
  assert.equal(store.login(second,['hema-theory']),undefined);
  assert.equal(store.scope(oldSession),undefined);
  assert.deepEqual(store.syncDevice('password-admin-test',[],86400000),[]);
  assert.equal(store.scope(otherSession),'report:batmany-na-meche');
  assert(store.login(replacement,['hema-theory']));
  assert(store.login(ownerKey,['report:batmany-na-meche']));
  const updated = await call(saved.headers.location,owner.cookie);
  assert.equal(updated.status,200);assert.match(updated.text,/role="status"/);
  assert(updated.text.includes('&lt;img&amp;&gt;'));
  assert(!updated.text.includes(replacement));assert(!updated.text.includes(old));
  assert.equal([...updated.text.matchAll(/data-password-access>/g)].length,2);
  const logout = await call('/admin/logout',owner.cookie,'');
  assert.equal(logout.status,303);assert.equal(logout.headers.location,'/');
  assert.equal((await call('/admin/',owner.cookie)).status,403);
});

test('legacy hashes are recovered only from a matching password, saved passwords survive restart encrypted, shared scopes rotate independently', t => {
  const directory = mkdtempSync(join(tmpdir(),'hema-password-admin-'));
  t.after(() => rmSync(directory,{recursive:true,force:true}));
  const path = join(directory,'access.sqlite');
  let store = openAccessStore(path);
  store.close();
  const legacy = 'legacy-private-password';
  const db = new DatabaseSync(path);
  db.prepare('INSERT INTO grants VALUES (?,?)').run(hash(legacy),'first');
  db.prepare('INSERT INTO additional_grants VALUES (?,?)').run(hash(legacy),'second');
  db.prepare('INSERT INTO additional_grants VALUES (?,?)').run(hash(legacy),'third');
  db.close();
  store = openAccessStore(path);
  try {
    assert.deepEqual(store.passwords().map(row=>row.password),[null,null,null]);
    store.rememberPasswords(['incorrect-password']);
    assert(store.passwords().every(row=>row.password===null));
    assert.equal(store.login(legacy,['wrong-scope']),undefined);
    assert(store.passwords().every(row=>row.password===null));
    assert(store.login(legacy,['second']));
    assert(store.passwords().every(row=>row.password===legacy));
    store.setPassword('first','first123');
    assert.equal(store.login(legacy,['first']),undefined);
    assert(store.login(legacy,['second']));assert(store.login(legacy,['third']));
    store.setPassword('third','third123');
    assert.equal(store.login(legacy,['third']),undefined);
    assert(store.login(legacy,['second']));
    assert.throws(()=>store.setCollectionKey('submission-report-'+'a'.repeat(32),null,hash('new12345')),/4 до 8/);
    store.setCollectionKey('submission-report-'+'a'.repeat(32),null,hash('new12345'),store.sealPassword('new12345'));
    assert.equal(store.passwords().find(row=>row.scope.startsWith('submission-')).password,'new12345');
    const inspector = new DatabaseSync(path);
    const encrypted = inspector.prepare('SELECT encrypted FROM saved_passwords').all();
    inspector.close();
    assert(encrypted.length>0);assert(encrypted.every(row=>!row.encrypted.includes(legacy)));
    const bytes = readFileSync(path);
    for (const secret of [legacy,'first123','third123','new12345']) assert(!bytes.includes(Buffer.from(secret)));
    const before = store.passwords();
    store.close();store = openAccessStore(path);
    assert.deepEqual(store.passwords(),before);
  } finally { store.close(); }
  unlinkSync(path+'.password-key');
  assert.throws(()=>openAccessStore(path),{code:'ENOENT'});
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { consolidatePasswords } from './consolidate-passwords.mjs';
import { passwordVault } from './password-vault.mjs';
import { openAccessStore } from './access-store.mjs';
import { validAccessPassword } from './password-policy.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');

test('one short password per group is enforced in storage, issuance and replacement, retaining the owner and shared short-key access', t=>{
  const directory=mkdtempSync(join(tmpdir(),'hema-single-password-'));
  const filename=join(directory,'access.sqlite');
  const db=new DatabaseSync(filename);let store;
  t.after(()=>{store?.close();db.close();rmSync(directory,{recursive:true,force:true});});
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE grants(key_hash TEXT PRIMARY KEY,scope TEXT NOT NULL);
    CREATE TABLE additional_grants(key_hash TEXT REFERENCES grants(key_hash) ON DELETE CASCADE,scope TEXT NOT NULL,PRIMARY KEY(key_hash,scope));
    CREATE TABLE sessions(session_hash TEXT PRIMARY KEY,key_hash TEXT REFERENCES grants(key_hash) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE device_grants(device TEXT,key_hash TEXT REFERENCES grants(key_hash) ON DELETE CASCADE,PRIMARY KEY(device,key_hash));
    CREATE TABLE device_sessions(session_hash TEXT PRIMARY KEY REFERENCES sessions(session_hash) ON DELETE CASCADE,device TEXT NOT NULL);
    CREATE TABLE saved_passwords(key_hash TEXT PRIMARY KEY REFERENCES grants(key_hash) ON DELETE CASCADE,encrypted TEXT NOT NULL);`);
  const vault=passwordVault(filename),owner='synthetic-owner-master-key-unchanged';
  const short='keep123',longA='synthetic-old-long-password-a',longB='synthetic-old-long-password-b',longC='synthetic-old-long-password-c';
  for(const [scope,password] of [['a',short],['a',longA],['b',longB],['c',longC],['archive:owner',owner]]){
    const digest=hash(password);db.prepare('INSERT INTO grants VALUES (?,?)').run(digest,scope);
    if(scope!=='archive:owner')db.prepare('INSERT INTO saved_passwords VALUES (?,?)').run(digest,vault.encrypt(password,digest));
  }
  db.prepare('INSERT INTO additional_grants VALUES (?,?)').run(hash(short),'c');
  for(const [token,password] of [['kept-session',short],['removed-session',longA],['owner-session',owner]]){
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token),hash(password),Date.now()+86400000);
    db.prepare('INSERT INTO device_grants VALUES (?,?)').run(token+'-device',hash(password));
    db.prepare('INSERT INTO device_sessions VALUES (?,?)').run(hash(token),token+'-device');
  }
  const grantsBefore=db.prepare('SELECT * FROM grants ORDER BY key_hash').all();
  const dry=consolidatePasswords(filename);assert.equal(dry.scopes,3);assert.equal(dry.keptShortPasswords,2);assert.equal(dry.generatedShortPasswords,1);
  assert.deepEqual(db.prepare('SELECT * FROM grants ORDER BY key_hash').all(),grantsBefore);
  const migrated=consolidatePasswords(filename,{write:true});assert.equal(migrated.passwordAssociationsAfter,3);assert.equal(migrated.revokedKeys,3);
  const counts=()=>db.prepare("SELECT scope,count(*) AS n FROM (SELECT scope FROM grants UNION ALL SELECT scope FROM additional_grants) WHERE scope<>'archive:owner' GROUP BY scope").all();
  assert(counts().every(row=>row.n===1));
  assert.throws(()=>db.prepare('INSERT INTO grants VALUES (?,?)').run(hash('second-password'),'a'));
  assert.throws(()=>db.prepare('INSERT INTO grants VALUES (?,?)').run(hash('second-password'),'c'),/Only one password/);
  assert.throws(()=>db.prepare('INSERT INTO additional_grants VALUES (?,?)').run(hash(short),'b'),/Only one password/);
  store=openAccessStore(filename);
  assert.equal(store.scope('kept-session'),'a');assert.equal(store.scope('removed-session'),undefined);assert.equal(store.scope('owner-session'),'archive:owner');
  assert(store.login(short,['a']));assert(store.login(short,['c']));assert.equal(store.login(longA),undefined);
  assert.equal(store.issue('a'),short);const next=store.issue('b');assert(validAccessPassword(next));assert.equal(next.length,8);assert.equal(store.issue('b'),next);
  const newKey=store.issue('new');assert(validAccessPassword(newKey));assert.equal(store.issue('new'),newKey);
  assert(store.passwords().every(row=>validAccessPassword(row.password)));
  store.setPassword('c',short);assert(store.login(short,['c']));
  store.setPassword('a','renew123');assert.equal(store.login(short,['a']),undefined);assert(store.login(short,['c']));assert(store.login('renew123',['a']));
  assert.throws(()=>store.setPassword('a','far-too-long-password'),/4 до 8/);
  assert.throws(()=>store.setPassword('a','abc'),/4 до 8/);
  assert(counts().every(row=>row.n===1));
  assert(store.login(owner,['a']));assert.equal(store.scope('owner-session'),'archive:owner');
  const repeated=consolidatePasswords(filename,{write:true});assert.equal(repeated.generatedShortPasswords,0);assert.equal(repeated.revokedKeys,0);
  assert.equal(store.issue('a'),'renew123');
});

test('short-password validation uses the same limits for forms and storage',()=>{
  for(const password of ['z9Qp','Abcd1234','пароль'])assert(validAccessPassword(password));
  for(const password of ['',null,'abc','123456789',' abcd','abcd ','abc\n','ab\tc'])assert(!validAccessPassword(password));
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { restorePasswords } from './restore-passwords.mjs';
import { passwordVault } from './password-vault.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(),'hema-restore-passwords-'));
  const path = join(directory,'access.sqlite');
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE grants(key_hash TEXT PRIMARY KEY,scope TEXT NOT NULL);
    CREATE TABLE additional_grants(key_hash TEXT,scope TEXT);
    CREATE TABLE sessions(session_hash TEXT,key_hash TEXT,expires INTEGER);
    CREATE TABLE device_grants(device TEXT,key_hash TEXT);
    CREATE TABLE saved_passwords(key_hash TEXT PRIMARY KEY REFERENCES grants(key_hash),encrypted TEXT NOT NULL);`);
  const owner = 'synthetic-owner-password';
  const first = 'synthetic-first-password', second = 'синтетический пароль второй';
  for (const [scope,password] of [['archive:owner',owner],['collection:first',first],['recording:second',second]]) {
    db.prepare('INSERT INTO grants VALUES (?,?)').run(digest(password),scope);
  }
  db.prepare('INSERT INTO additional_grants VALUES (?,?)').run(digest(first),'shared-recording');
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run('synthetic-session',digest(first),Date.now()+86400000);
  db.prepare('INSERT INTO device_grants VALUES (?,?)').run('synthetic-device',digest(first));
  const state = () => ['grants','additional_grants','sessions','device_grants'].map(table => db.prepare('SELECT * FROM '+table).all());
  t.after(() => {db.close();rmSync(directory,{recursive:true,force:true});});
  return {path,db,owner,first,second,state};
}

test('recovery proves complete coverage before importing; dry run and import never change keys, sessions or devices', t => {
  const f = fixture(t),before = f.state();
  assert.throws(()=>restorePasswords(f.path,[f.first],{write:true,requireComplete:true}),/No passwords were imported/);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM saved_passwords').get().n,0);
  assert.deepEqual(f.state(),before);
  const input=[f.owner,f.first,f.second,'unrelated-or-revoked-password'];
  const dryRun=restorePasswords(f.path,input,{requireComplete:true});
  assert.equal(dryRun.total,2);assert.equal(dryRun.matched,2);assert(dryRun.complete);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM saved_passwords').get().n,0);
  const saved=restorePasswords(f.path,input,{write:true,requireComplete:true});
  assert.equal(saved.availableAfter,2);assert.deepEqual(f.state(),before);
  const rows=f.db.prepare('SELECT * FROM saved_passwords ORDER BY key_hash').all();
  assert.equal(rows.length,2);assert(!rows.some(row=>row.key_hash===digest(f.owner)));
  const vault=passwordVault(f.path);
  assert.deepEqual(new Set(rows.map(row=>vault.decrypt(row.encrypted,row.key_hash))),new Set([f.first,f.second]));
  assert(!readFileSync(f.path).includes(Buffer.from(f.first)));
  const again=restorePasswords(f.path,[],{write:true,requireComplete:true});
  assert.equal(again.matched,0);assert.equal(again.availableBefore,2);
  assert.deepEqual(f.db.prepare('SELECT * FROM saved_passwords ORDER BY key_hash').all(),rows);
  assert.deepEqual(f.state(),before);
});

test('CLI receives secrets only through stdin and never echoes them or their hashes', t => {
  const f=fixture(t);
  const run=(args,input)=>spawnSync(process.execPath,[fileURLToPath(new URL('./restore-passwords.mjs',import.meta.url)),f.path,...args],{input,encoding:'utf8'});
  const failed=run(['--write','--require-complete'],JSON.stringify({passwords:[f.first]}));
  assert.equal(failed.status,1);assert.match(failed.stderr,/Recovery incomplete/);
  const good=run(['--write','--require-complete'],JSON.stringify({passwords:[f.first,f.second,f.owner]}));
  assert.equal(good.status,0);assert.equal(JSON.parse(good.stdout).availableAfter,2);
  const invalid=run([],'{not-valid-secret-json');assert.equal(invalid.status,1);assert.equal(invalid.stderr.trim(),'Invalid recovery JSON.');
  for(const output of [failed.stdout+failed.stderr,good.stdout+good.stderr,invalid.stdout+invalid.stderr]) {
    for(const password of [f.first,f.second,f.owner]) {assert(!output.includes(password));assert(!output.includes(digest(password)));}
  }
});

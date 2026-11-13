import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { passwordVault } from './password-vault.mjs';
import { validAccessPassword, shortAccessPassword, enforceSinglePasswordSchema } from './password-policy.mjs';

const owner = 'archive:owner';
const digest = value => createHash('sha256').update(value).digest('hex');

export function consolidatePasswords(filename,{write=false}={}) {
  if (!existsSync(filename)) throw Error('Existing access database not found.');
  const db = new DatabaseSync(filename,{readOnly:!write});
  try {
    db.exec('PRAGMA foreign_keys=ON');
    if (write) db.exec('BEGIN IMMEDIATE');
    try {
      const vault = passwordVault(filename);
      const grants = db.prepare('SELECT key_hash,scope FROM grants').all();
      const saved = new Map(db.prepare('SELECT key_hash,encrypted FROM saved_passwords').all().map(row=>[row.key_hash,row.encrypted]));
      if (saved.size) vault.openExisting();
      const secrets = new Map();
      for (const grant of grants) {
        if (grant.scope === owner || !saved.has(grant.key_hash)) continue;
        const password = vault.decrypt(saved.get(grant.key_hash),grant.key_hash);
        if (digest(password) !== grant.key_hash) throw Error('Saved password verification failed.');
        secrets.set(grant.key_hash,password);
      }
      const associations = db.prepare(`SELECT scope,key_hash FROM grants WHERE scope<>?
        UNION SELECT a.scope,a.key_hash FROM additional_grants a JOIN grants g USING(key_hash) WHERE a.scope<>? AND g.scope<>?
        ORDER BY scope,key_hash`).all(owner,owner,owner);
      const groups = new Map();
      for (const row of associations) {
        const values = groups.get(row.scope) ?? [];
        values.push(row.key_hash);groups.set(row.scope,values);
      }
      const desired = new Map(),occupied = new Set(grants.map(row=>row.key_hash));
      let kept = 0,generated = 0;
      for (const [scope,hashes] of groups) {
        const candidates = hashes.filter(hash=>validAccessPassword(secrets.get(hash)))
          .sort((a,b)=>secrets.get(a).length-secrets.get(b).length || a.localeCompare(b));
        if (candidates.length) { desired.set(scope,{hash:candidates[0],password:secrets.get(candidates[0])});kept++; }
        else {
          let password,hash;
          do {password=shortAccessPassword();hash=digest(password);} while (occupied.has(hash));
          occupied.add(hash);desired.set(scope,{hash,password});generated++;
        }
      }
      const byHash = new Map();
      for (const [scope,value] of desired) {const scopes=byHash.get(value.hash)??[];scopes.push(scope);byHash.set(value.hash,scopes);}
      const revoked = grants.filter(row=>row.scope!==owner&&!byHash.has(row.key_hash)).length;
      if (write) {
        db.prepare('DELETE FROM additional_grants WHERE scope<>?').run(owner);
        for (const grant of grants) if (grant.scope!==owner&&!byHash.has(grant.key_hash)) db.prepare('DELETE FROM grants WHERE key_hash=?').run(grant.key_hash);
        for (const [hash,scopes] of byHash) {
          const existing = grants.find(row=>row.key_hash===hash);
          const primary = existing && scopes.includes(existing.scope) ? existing.scope : scopes[0];
          if (existing) db.prepare('UPDATE grants SET scope=? WHERE key_hash=?').run(primary,hash);
          else db.prepare('INSERT INTO grants(key_hash,scope) VALUES (?,?)').run(hash,primary);
          if (!saved.has(hash)) {
            const password = desired.get(primary).password;
            db.prepare('INSERT INTO saved_passwords(key_hash,encrypted) VALUES (?,?)').run(hash,vault.encrypt(password,hash));
          }
          for (const scope of scopes) if (scope!==primary) db.prepare('INSERT INTO additional_grants(key_hash,scope) VALUES (?,?)').run(hash,scope);
        }
        enforceSinglePasswordSchema(db);
        db.exec('COMMIT');
      }
      return {ok:true,write,scopes:groups.size,passwordAssociationsBefore:associations.length,keptShortPasswords:kept,
        generatedShortPasswords:generated,revokedKeys:revoked,passwordAssociationsAfter:desired.size,maxPasswordLength:8};
    } catch (error) { if (write) db.exec('ROLLBACK');throw error; }
  } finally {db.close();}
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [filename,...args]=process.argv.slice(2);
    if (!filename || args.some(arg=>arg!=='--write')) throw Error('Use consolidate-passwords.mjs <existing-db> [--write]');
    console.log(JSON.stringify(consolidatePasswords(filename,{write:args.includes('--write')})));
  } catch(error) {console.error(error.message);process.exitCode=1;}
}

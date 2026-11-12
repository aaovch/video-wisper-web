import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { passwordVault } from './password-vault.mjs';

const OWNER_SCOPE = 'archive:owner';
const digest = value => createHash('sha256').update(value).digest('hex');

/** Restore known plaintext only when its hash matches an existing non-owner grant. */
export function restorePasswords(databasePath, passwords, {write=false, requireComplete=false} = {}) {
  if (!Array.isArray(passwords) || passwords.some(value => typeof value !== 'string' || !value.length || value.length > 128)) {
    throw Error('Expected an array of passwords, each from 1 to 128 characters.');
  }
  if (!existsSync(databasePath)) throw Error('The existing access database was not found.');
  const db = new DatabaseSync(databasePath, {readOnly:!write});
  try {
    db.exec('PRAGMA foreign_keys=ON');
    const vault = passwordVault(databasePath);
    if (db.prepare('SELECT 1 FROM saved_passwords LIMIT 1').get()) vault.openExisting();
    const candidates = new Map(passwords.map(password => [digest(password), password]));
    if (write) db.exec('BEGIN IMMEDIATE');
    try {
      const rows = db.prepare(`SELECT g.key_hash,g.scope,p.encrypted FROM grants g
        LEFT JOIN saved_passwords p USING(key_hash) WHERE g.scope<>? ORDER BY g.scope,g.key_hash`).all(OWNER_SCOPE);
      const pending = [], missing = [];
      let available = 0;
      for (const row of rows) {
        if (row.encrypted) {
          if (digest(vault.decrypt(row.encrypted,row.key_hash)) !== row.key_hash) throw Error('A saved password failed verification.');
          available++;
        } else if (candidates.has(row.key_hash)) pending.push({hash:row.key_hash,password:candidates.get(row.key_hash)});
        else missing.push(row.scope);
      }
      const result = {ok:true,write,total:rows.length,availableBefore:available,matched:pending.length,
        availableAfter:available+pending.length,missing:missing.length,missingScopes:[...new Set(missing)],complete:missing.length===0};
      if (requireComplete && missing.length) throw Error(`Recovery incomplete: ${missing.length} passwords still unavailable. No passwords were imported.`);
      if (write) {
        const save = db.prepare('INSERT INTO saved_passwords(key_hash,encrypted) VALUES (?,?)');
        for (const row of pending) save.run(row.hash,vault.encrypt(row.password,row.hash));
        db.exec('COMMIT');
      }
      return result;
    } catch (error) { if (write) db.exec('ROLLBACK'); throw error; }
  } finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [databasePath,...options] = process.argv.slice(2);
    if (!databasePath || options.some(option => !['--write','--require-complete'].includes(option))) {
      throw Error('Use restore-passwords.mjs <existing-db> [--write] [--require-complete]; provide {"passwords":[...]} on stdin.');
    }
    const chunks = [];let bytes = 0;
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      if (bytes > 1024*1024) throw Error('Password recovery input exceeds 1 MiB.');
      chunks.push(chunk);
    }
    let input;
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw Error('Invalid recovery JSON.'); }
    const result = restorePasswords(databasePath,input?.passwords,{write:options.includes('--write'),requireComplete:options.includes('--require-complete')});
    console.log(JSON.stringify(result));
  } catch (error) {
    // Never echo input, passwords, or their hashes in diagnostics.
    console.error(error.message);process.exitCode = 1;
  }
}

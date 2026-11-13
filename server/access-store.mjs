import { DatabaseSync } from 'node:sqlite';
import { createAnalyticsStore } from './analytics-store.mjs';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { OWNER_SCOPE } from './access-policy.mjs';
import { passwordVault } from './password-vault.mjs';
import { validAccessPassword, shortAccessPassword, PASSWORD_ERROR, enforceSinglePasswordSchema } from './password-policy.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');

export function openAccessStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS grants (key_hash TEXT PRIMARY KEY, scope TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS additional_grants (
      key_hash TEXT NOT NULL REFERENCES grants(key_hash) ON DELETE CASCADE,
      scope TEXT NOT NULL,
      PRIMARY KEY (key_hash, scope)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      session_hash TEXT PRIMARY KEY, key_hash TEXT REFERENCES grants(key_hash) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS device_grants (
      device TEXT NOT NULL, key_hash TEXT NOT NULL REFERENCES grants(key_hash) ON DELETE CASCADE,
      PRIMARY KEY (device,key_hash)
    );
    CREATE TABLE IF NOT EXISTS device_sessions (
      session_hash TEXT PRIMARY KEY REFERENCES sessions(session_hash) ON DELETE CASCADE, device TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saved_passwords (
      key_hash TEXT PRIMARY KEY REFERENCES grants(key_hash) ON DELETE CASCADE,
      encrypted TEXT NOT NULL
    );
  `);
  try { enforceSinglePasswordSchema(db); } catch(error) {db.close();throw error;}
  const vault = passwordVault(filename);
  if (db.prepare('SELECT 1 FROM saved_passwords LIMIT 1').get()) {
    try { vault.openExisting(); } catch (error) { db.close(); throw error; }
  }
  function rememberPassword(key) {
    if (typeof key !== 'string' || !key) return;
    const hash = digest(key);
    const grant = db.prepare('SELECT scope FROM grants WHERE key_hash=?').get(hash);
    if (!grant || grant.scope === OWNER_SCOPE) return;
    if (!db.prepare('SELECT 1 FROM saved_passwords WHERE key_hash=?').get(hash)) {
      db.prepare('INSERT INTO saved_passwords VALUES (?,?)').run(hash, vault.encrypt(key, hash));
    }
  }
  function replacePassword(scope, keyHash, key) {
    const existing = db.prepare('SELECT scope FROM grants WHERE key_hash=?').get(keyHash);
    if (existing && existing.scope !== scope) {
      if (db.prepare('SELECT 1 FROM additional_grants WHERE scope=? AND key_hash=?').get(scope,keyHash)) {if(key)rememberPassword(key);return;}
      throw Error('Этот пароль уже используется. Выберите другой.');
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      // A legacy shared key may still open other scopes. Keep those grants.
      for (const old of db.prepare('SELECT key_hash FROM grants WHERE scope=? AND key_hash<>?').all(scope,keyHash)) {
        const extra = db.prepare('SELECT scope FROM additional_grants WHERE key_hash=? ORDER BY scope LIMIT 1').get(old.key_hash);
        if (extra) {
          db.prepare('DELETE FROM additional_grants WHERE key_hash=? AND scope=?').run(old.key_hash,extra.scope);
          db.prepare('UPDATE grants SET scope=? WHERE key_hash=?').run(extra.scope,old.key_hash);
        } else db.prepare('DELETE FROM grants WHERE key_hash=?').run(old.key_hash);
      }
      db.prepare('DELETE FROM additional_grants WHERE scope=?').run(scope);
      db.prepare('INSERT OR IGNORE INTO grants VALUES (?,?)').run(keyHash,scope);
      if (key) rememberPassword(key);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const analytics = createAnalyticsStore(db);
  const cleanup = setInterval(() => {
    try { analytics.purge(); } catch (error) { console.error('Analytics cleanup failed:', error.code ?? error.name); }
  }, 60_000);
  cleanup.unref();
  return {
    analytics,
    issue(scope) {
      let key = scope === OWNER_SCOPE ? token() : shortAccessPassword();
      db.exec('BEGIN IMMEDIATE');
      try {
        if (scope !== OWNER_SCOPE) {
          const current=db.prepare(`SELECT key_hash FROM grants WHERE scope=? UNION SELECT key_hash FROM additional_grants WHERE scope=?`).get(scope,scope);
          if (current) {
            const saved=db.prepare('SELECT encrypted FROM saved_passwords WHERE key_hash=?').get(current.key_hash);
            if(!saved)throw Error('Сначала восстановите сохранённый пароль этой группы.');
            key=vault.decrypt(saved.encrypted,current.key_hash);
            if(!validAccessPassword(key))throw Error('Сначала задайте короткий пароль этой группы.');
            db.exec('COMMIT');return key;
          }
        }
        db.prepare('INSERT INTO grants VALUES (?, ?)').run(digest(key), scope);
        rememberPassword(key);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return key;
    },
    rememberPasswords(keys) { for (const key of keys) rememberPassword(key); },
    sealPassword(key) { return vault.encrypt(key,digest(key)); },
    passwords() {
      return db.prepare(`
        SELECT g.scope,g.key_hash,p.encrypted FROM grants g LEFT JOIN saved_passwords p USING(key_hash) WHERE g.scope<>?
        UNION
        SELECT a.scope,a.key_hash,p.encrypted FROM additional_grants a JOIN grants g USING(key_hash)
          LEFT JOIN saved_passwords p USING(key_hash) WHERE a.scope<>? AND g.scope<>?
        ORDER BY scope,key_hash
      `).all(OWNER_SCOPE,OWNER_SCOPE,OWNER_SCOPE).map(row => ({scope:row.scope, password:row.encrypted ? vault.decrypt(row.encrypted,row.key_hash) : null}));
    },
    setPassword(scope,key) {
      if (typeof scope !== 'string' || !scope || scope === OWNER_SCOPE) throw Error('Нельзя изменять мастер-ключ через эту форму.');
      if (!validAccessPassword(key)) throw Error(PASSWORD_ERROR);
      replacePassword(scope,digest(key),key);
    },
    setCollectionKey(scope,key,savedHash,sealed) {
      if(key && typeof key!=='string')throw Error(PASSWORD_ERROR);
      if (!/^submission-(?:collection|report)-[a-f0-9]{32}$/.test(scope) || (!key && !/^[a-f0-9]{64}$/.test(savedHash))) throw Error(PASSWORD_ERROR);
      const keyHash=key ? digest(key) : savedHash;
      if (!key && sealed) {
        key = vault.decrypt(sealed,keyHash);
        if (digest(key) !== keyHash) throw Error('Пароль не соответствует сохранённому ключу.');
      }
      if (!key) {
        const saved=db.prepare('SELECT encrypted FROM saved_passwords WHERE key_hash=?').get(keyHash);
        if(saved)key=vault.decrypt(saved.encrypted,keyHash);
      }
      if(!validAccessPassword(key))throw Error(PASSWORD_ERROR);
      replacePassword(scope,keyHash,key);
    },
    revoke(scope) {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('DELETE FROM additional_grants WHERE scope = ?').run(scope);
        db.prepare('DELETE FROM grants WHERE scope = ?').run(scope);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    login(key, targets, lifetime = 86400000) {
      const keyHash = digest(key);
      const grant = db.prepare('SELECT scope FROM grants WHERE key_hash = ?').get(keyHash);
      if (!grant) return;
      if (grant.scope !== OWNER_SCOPE && targets && !targets.includes(grant.scope)) {
        const extra = db.prepare('SELECT scope FROM additional_grants WHERE key_hash=?').all(keyHash);
        if (!extra.some(row => targets.includes(row.scope))) return;
      }
      rememberPassword(key);
      const session = token();
      db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(session), keyHash, Date.now() + lifetime);
      return session;
    },
    scope(session) {
      return db.prepare('SELECT scope FROM sessions JOIN grants USING (key_hash) WHERE session_hash = ? AND expires > ?')
        .get(digest(session), Date.now())?.scope;
    },
    scopes(session) {
      const hash = digest(session);
      return db.prepare(`
        SELECT g.scope FROM sessions s JOIN grants g USING(key_hash) WHERE s.session_hash=? AND s.expires>?
        UNION ALL
        SELECT a.scope FROM sessions s JOIN additional_grants a USING(key_hash) WHERE s.session_hash=? AND s.expires>?
      `).all(hash, Date.now(), hash, Date.now()).map(row => row.scope);
    },
    syncDevice(device, tokens, lifetime) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const active = new Set(), restored = [], now = Date.now();
        for (const raw of tokens) {
          const hash = digest(raw);
          const grant = db.prepare('SELECT key_hash, scope FROM sessions JOIN grants USING(key_hash) WHERE session_hash=? AND expires>?').get(hash,now);
          if (!grant) continue;
          active.add(grant.scope);
          db.prepare('INSERT OR IGNORE INTO device_grants VALUES (?,?)').run(device,grant.key_hash);
          db.prepare('INSERT OR REPLACE INTO device_sessions VALUES (?,?)').run(hash,device);
          db.prepare('UPDATE sessions SET expires=? WHERE session_hash=?').run(now+lifetime,hash);
        }
        for (const {scope,key_hash} of db.prepare('SELECT scope,key_hash FROM device_grants JOIN grants USING(key_hash) WHERE device=?').all(device)) {
          if (active.has(scope)) continue;
          active.add(scope);
          const raw = token(), hash = digest(raw);
          db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash,key_hash,now+lifetime);
          db.prepare('INSERT INTO device_sessions VALUES (?,?)').run(hash,device);
          restored.push([scope,raw]);
        }
        db.exec('COMMIT');
        return restored;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    forget(session) {
      const device = db.prepare('SELECT device FROM device_sessions WHERE session_hash=?').get(digest(session))?.device;
      if (!device) return;
      db.prepare('DELETE FROM device_grants WHERE device=?').run(device);
      db.prepare('DELETE FROM sessions WHERE session_hash IN (SELECT session_hash FROM device_sessions WHERE device=?)').run(device);
    },
    logout(session) {
      db.prepare('DELETE FROM sessions WHERE session_hash = ?').run(digest(session));
    },
    close() { clearInterval(cleanup); db.close(); }
  };
}

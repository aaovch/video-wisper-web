import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

// The encryption key lives beside the private access DB, never in site assets.
export function passwordVault(databasePath) {
  let key;
  function encryptionKey(create = true) {
    if (key) return key;
    if (databasePath === ':memory:') return key = randomBytes(32);
    const path = databasePath + '.password-key';
    try { key = readFileSync(path); }
    catch (error) {
      if (error.code !== 'ENOENT' || !create) throw error;
      const candidate = randomBytes(32);
      try { writeFileSync(path, candidate, {flag:'wx', mode:0o600}); key = candidate; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        key = readFileSync(path);
      }
    }
    if (key.length !== 32) throw Error('Invalid password vault key');
    return key;
  }
  return {
    openExisting() { encryptionKey(false); },
    encrypt(password, hash) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
      cipher.setAAD(Buffer.from(hash));
      const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
    },
    decrypt(value, hash) {
      const bytes = Buffer.from(value, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey(false), bytes.subarray(0,12));
      decipher.setAAD(Buffer.from(hash));
      decipher.setAuthTag(bytes.subarray(12,28));
      return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
    }
  };
}

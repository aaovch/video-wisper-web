import { createPublicKey, randomBytes, verify } from 'node:crypto';

// A challenge is valid once, on this server process, for one minute.
export function deviceChallenges() {
  const pending = new Map();
  return {
    issue() {
      const now = Date.now();
      for (const [key, until] of pending) {
        if (until > now) break;
        pending.delete(key);
      }
      if (pending.size >= 4096) return;
      const value = randomBytes(32).toString('base64url');
      pending.set(value, now + 60000);
      return value;
    },
    verify({challenge, publicKey, signature}) {
      const until = pending.get(challenge);
      pending.delete(challenge);
      if (!(until > Date.now())) return false;
      try {
        const key = createPublicKey({key:Buffer.from(publicKey,'base64'), format:'der', type:'spki'});
        return key.asymmetricKeyDetails?.namedCurve === 'prime256v1' &&
          key.export({format:'der',type:'spki'}).toString('base64') === publicKey &&
          verify('sha256', Buffer.from(challenge), {key,dsaEncoding:'ieee-p1363'}, Buffer.from(signature,'base64'));
      } catch { return false; }
    }
  };
}

(async () => {
  // The private key stays in this browser and cannot be exported as bytes.
  const request = r => new Promise((resolve,reject) => {
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  const opening = indexedDB.open('hema-device', 1);
  opening.onupgradeneeded = () => opening.result.createObjectStore('keys');
  const db = await request(opening);
  try {
    const read = () => request(db.transaction('keys').objectStore('keys').get('device'));
    let pair = await read();
    if (!pair && !globalThis.__hema?.unlocked?.length) return;
    if (!pair) {
      pair = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
      try { await request(db.transaction('keys','readwrite').objectStore('keys').add(pair,'device')); }
      catch (error) { if (error.name !== 'ConstraintError') throw error; pair = await read(); }
    }
    const encode = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
    const response = await fetch('/api/device/challenge',{method:'POST'});
    if (!response.ok) return;
    const challenge = await response.text();
    const signature = encode(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(challenge)));
    const publicKey = encode(await crypto.subtle.exportKey('spki',pair.publicKey));
    const restored = await fetch('/api/device/remember',{method:'POST',body:JSON.stringify({publicKey,signature,challenge})});
    if (restored.ok && (await restored.json()).restored) location.reload();
  } finally { db.close(); }
})().catch(() => {}); // Storage can be disabled; the normal cookie still works.

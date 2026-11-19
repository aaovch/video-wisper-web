import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

export async function accessToken(credential, fetcher = fetch) {
  const now = Math.floor(Date.now()/1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:credential.client_email,scope:'https://www.googleapis.com/auth/cloud-platform',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+600});
  const signature = createSign('RSA-SHA256').update(input).sign(credential.private_key,'base64url');
  const response = await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:input+'.'+signature}),signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw Error(`Google authentication failed (${response.status})`);
  const body = await response.json(); if (!body.access_token) throw Error('Google token missing'); return body.access_token;
}

async function fetchWithRetry(fetcher, url, options) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetcher(url, {...options, signal:AbortSignal.timeout(20000)});
      if (attempt === 2 || ![429, 502, 503, 504].includes(response.status)) return response;
      await response.body?.cancel();
    } catch (error) {
      if (attempt === 2) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000));
  }
}

export function startDispatcher(store, { jobName, credentialsFile, fetcher = fetch, intervalMs = 15000 }) {
  if (!/^projects\/[a-z0-9-]+\/locations\/[a-z0-9-]+\/jobs\/[a-z0-9-]+$/.test(jobName)) throw Error('Invalid Cloud Run job name');
  const credential = JSON.parse(readFileSync(credentialsFile,'utf8'));
  let busy = false;
  const tick = async () => {
    if (busy) return; busy = true;
    let job;
    try {
      job = store.claim(true); if (!job) return;
      const token = await accessToken(credential,(url, options) => fetchWithRetry(fetcher, url, options));
      // All submissions of this request use the same lease. Only one worker can begin it.
      const response = await fetchWithRetry(fetcher, `https://run.googleapis.com/v2/${jobName}:run`, {method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({overrides:{containerOverrides:[{env:[{name:'HEMA_JOB_ID',value:job.id},{name:'HEMA_JOB_LEASE',value:job.lease}]}]}}),signal:AbortSignal.timeout(30000)});
      if (!response.ok) throw Error(`Cloud Run dispatch failed (${response.status})`);
      console.info('Cloud Run job dispatched:',job.id);
    } catch (error) { if (job && store.get(job.id)?.state === 'launching') store.fail(job.id,job.lease); console.error('Cloud Run dispatch:',error.message); }
    finally { busy = false; }
  };
  const timer = setInterval(tick,intervalMs); timer.unref(); void tick();
  return () => clearInterval(timer);
}

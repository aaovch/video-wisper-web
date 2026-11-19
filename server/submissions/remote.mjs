import { skillRequest } from './skill-bridge.mjs';
import { timingSafeEqual, createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest();
export function workerHandler(store, secret) {
  return async ({ req, res, pathname }) => {
    if (pathname === '/internal/submissions/skill') return skillRequest(req,res,store);
    if (!pathname.startsWith('/internal/submissions/')) return false;
    const send = (code, body = {}) => { res.writeHead(code, { 'Content-Type':'application/json', 'Cache-Control':'no-store' }); res.end(JSON.stringify(body)); return true; };
    if (!store || !secret || secret.length < 40 || !timingSafeEqual(digest(req.headers.authorization ?? ''), digest(`Bearer ${secret}`))) return send(403);
    if (req.method !== 'POST') return send(405);
    try {
      let bytes = 0; const chunks = [];
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 2_000_000) return send(413); chunks.push(chunk); }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!/^[a-f0-9]{32}$/.test(data.id) || !/^[a-f0-9]{32}$/.test(data.lease)) return send(400);
      const row = store.get(data.id);
      const action = pathname.slice('/internal/submissions/'.length);
      if(action==='finish' && row && ['review','published'].includes(row.state) && JSON.stringify(row.draft)===JSON.stringify(data.draft))return send(200,{ok:true});
      if (action === 'heartbeat' && row && row.lease !== data.lease) return send(200,{ok:false});
      if (!row || row.lease !== data.lease || row.cloud_audio_consent !== 1) return send(409);
      if (action === 'get' && !store.begin(data.id,data.lease)) return send(409);
      if (action === 'get') return send(200, {id:row.id,lease:row.lease,url:row.url,cloud_audio_consent:row.cloud_audio_consent,checkpoint:row.checkpoint,sections:row.sections,candidate:row.candidate});
      if (action === 'heartbeat') return send(200, {ok:store.heartbeat(data.id,data.lease)});
      if (action === 'transcript') store.saveTranscript(data.id,data.lease,data.checkpoint);
      else if (action === 'candidate') store.saveCandidate(data.id,data.lease,data.candidate);
      else if (action === 'section') store.saveSection(data.id,data.lease,data.section);
      else if (action === 'stage') store.stage(data.id,data.lease,data.state,data.title);
      else if (action === 'finish') {
        if (!data.draft || !Array.isArray(data.draft.segments) || !Array.isArray(data.draft.chapters) || !Array.isArray(data.draft.overview) || typeof data.draft.title !== 'string' || typeof data.draft.review?.pass !== 'boolean' || !Array.isArray(data.draft.review?.issues)) return send(400);
        store.finish(data.id,data.lease,data.draft);
      } else if (action === 'fail') store.fail(data.id,data.lease);
      else return send(404);
      return send(200,{ok:true});
    } catch { return send(400); }
  };
}

export function remoteStore(origin, secret, fetcher = fetch) {
  if (new URL(origin).protocol !== 'https:') throw Error('Worker requires HTTPS');
  const call = async (action, data) => {
    const request=()=>fetcher(new URL('/internal/submissions/'+action,origin), { method:'POST', redirect:'error', headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'}, body:JSON.stringify(data), signal:AbortSignal.timeout(20000) });
    let response;
    for(let attempt=0;attempt<3;attempt++) {
      try {
        response = await request();
        if (action === 'get' || attempt === 2 || ![429,502,503,504].includes(response.status)) break;
        await response.body?.cancel();
        await new Promise(resolve=>setTimeout(resolve,(attempt+1)*1000));
      }
      catch(error){
        // Connect timeout means no HTTP request reached the server. All other
        // get failures are ambiguous because begin changes the durable lease.
        if(attempt===2 || (action==='get' && error.cause?.code!=='UND_ERR_CONNECT_TIMEOUT'))
          throw Error(`Site worker ${action} connection failed`,{cause:error.cause ?? error});
      }
    }
    if (!response.ok) throw Error(`Site worker request failed (${response.status})`);
    return response.json();
  };
  return {
    get:(id,lease) => call('get',{id,lease}),
    heartbeat:async (id,lease) => (await call('heartbeat',{id,lease})).ok === true,
    stage:(id,lease,state,title) => call('stage',{id,lease,state,title}),
    saveCandidate:(id,lease,candidate) => call('candidate',{id,lease,candidate}),
    saveSection:(id,lease,section) => call('section',{id,lease,section}),
    saveTranscript:(id,lease,checkpoint) => call('transcript',{id,lease,checkpoint}),
    finish:(id,lease,draft) => call('finish',{id,lease,draft}),
    fail:(id,lease) => call('fail',{id,lease})
  };
}

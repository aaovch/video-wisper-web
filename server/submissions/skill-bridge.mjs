import { createHash } from 'node:crypto';

export const skillId = token => createHash('sha256').update(token).digest('hex').slice(0,32);

export async function skillRequest(req, res, store) {
  const send = (status, data = {}) => {
    res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(data));
    return true;
  };
  const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1];
  if (!store || !token || req.method !== 'POST') return send(403);
  const id = skillId(token);
  const row = store.get(id);
  if (row?.source !== 'skill') return send(403);
  try {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024) return send(413);
      chunks.push(chunk);
    }
    const {action,lease,state} = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (action === 'claim') return send(200,store.claimLocal(id) ?? {state:row.state});
    if (!row.lease || row.lease !== lease) return send(409);
    if (action === 'heartbeat') return send(store.heartbeat(id,lease) ? 200 : 409);
    if (action === 'stage') store.stage(id,lease,state);
    else if (action === 'finish') return send(store.finishLocal(id,lease) ? 200 : 409);
    else if (action === 'fail') store.fail(id,lease);
    else return send(400);
    return send(200);
  } catch { return send(400); }
}

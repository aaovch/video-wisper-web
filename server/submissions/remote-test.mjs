import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { openSubmissions } from './store.mjs';
import { workerHandler, remoteStore } from './remote.mjs';

test('start retries only confirmed connect timeouts, bounded to three; ambiguous delivery never retries',async()=>{
 for(const code of ['UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET']){
  let calls=0;
  await assert.rejects(remoteStore('https://synthetic.invalid','fixture',async()=>{calls++;throw Error('network',{cause:{code}});}).get('a','b'));
  assert.equal(calls,code==='UND_ERR_CONNECT_TIMEOUT'?3:1);
 }
 let calls=0;const remote=remoteStore('https://synthetic.invalid','fixture',async()=>{if(++calls===1)throw Error('network',{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}});return Response.json({id:'a'});});
 assert.equal((await remote.get('a','b')).id,'a');assert.equal(calls,2);
});

test('remote worker requires secret and exact durable lease; cannot publish or replay completion', async () => {
  const store = openSubmissions(':memory:');
  const secret = 'synthetic-only-worker-secret-'.repeat(3);
  const handler = workerHandler(store,secret);
  const server = createServer(async (req,res) => { if (!await handler({req,res,pathname:req.url})) { res.writeHead(404);res.end(); } });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const fetcher = (url,options) => fetch(origin+new URL(url).pathname,options);
  const remote = remoteStore('https://synthetic.invalid',secret,fetcher);
  try {
    const id = store.create('fixture','https://youtu.be/abcdefghijk',true);
    const second = store.create('fixture','https://youtu.be/abcdefghijl',true);
    const job = store.claim(true); assert.equal(job.id,id); assert.equal(store.claim(),null);
    await assert.rejects(remoteStore('https://synthetic.invalid','wrong',fetcher).get(id,job.lease),/403/);
    await assert.rejects(remote.get(id,'0'.repeat(32)),/409/);
    assert.equal((await remote.get(id,job.lease)).url,job.url);
    await assert.rejects(remote.get(id,job.lease),/409/);
    assert.equal(await remote.heartbeat(id,job.lease),true);
    await assert.rejects(remote.stage(id,job.lease,'published'),/400/);
    await remote.stage(id,job.lease,'transcribing');
    assert.equal(store.get(id).state,'transcribing');
    const claim={text:'Шаг',citations:[{segment_id:0,quote:'Шаг'}],rationale:'Источник'};
    const result={title:'Fixture',segments:[{id:0,start:0,end:1,text:'Шаг'}],chapters:[{first:0,last:0,title:claim,summary:claim,points:[]}],overview:[claim],review:{pass:true,issues:[]}};
    await assert.rejects(remote.finish(id,job.lease,{...result,final_result:true,review:{pass:false,issues:[]}}),/400/);
    await remote.finish(id,job.lease,result);
    await remote.finish(id,job.lease,result); // Lost acknowledgement is safe to replay.
    await assert.rejects(remote.finish(id,job.lease,{...result,title:'Changed'}),/409/);
    assert.equal(store.get(id).state,'review');
    await assert.rejects(remote.get(id,job.lease),/409/);
    assert.throws(()=>store.decide(id,true,false));
    assert.equal(store.claim().id,second);
  } finally { server.closeAllConnections(); await new Promise(r=>server.close(r)); store.close(); }
});

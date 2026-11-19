import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {materialPolicyIdentity,materialInstructions,fidelityChecks} from './report-format.mjs';
import {editorialInstructions,validateEditorial} from './editorial.mjs';
import {reviewInstructions,readerInstructions,targetedRepairInstructions,reviewAndImprove} from './editorial-workflow.mjs';

const contractCLI=fileURLToPath(new URL('./report-format.mjs',import.meta.url));
const text='Закройте линию.';
const transcript={duration:1,segments:[{id:0,start:0,end:1,text}]};
function draft(checks=fidelityChecks) {
  const claim={text,citations:[{segment_id:0,quote:text}],rationale:'Synthetic instruction',checks};
  return {format_version:'archive-skill-v2',presentation:{version:'hema-report-v1',title:claim,subtitle:claim,tags:[]},
    overview:[claim],chapters:[{first:0,last:0,title:claim,summary:claim,points:[]}],
    materials:{notes:[],exercises:[],glossary:[]},
    source_coverage:[{first:0,last:0,disposition:'summarized',reason:'Synthetic topic'}],terminology:[],limitations:[]};
}

test('CLI consumed by skills emits the identical policy used in every server stage',()=>{
  const prompts={prepare:editorialInstructions,review:reviewInstructions,reader:readerInstructions,revision:targetedRepairInstructions};
  for(const [stage,prompt] of Object.entries(prompts)) {
    const result=spawnSync(process.execPath,[contractCLI,'instructions',stage],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.equal(result.stdout.trimEnd(),materialInstructions(stage));
    assert.ok(prompt.includes(result.stdout.trimEnd()),stage+' omitted the shared contract');
  }
  const invalid=spawnSync(process.execPath,[contractCLI,'instructions','unknown'],{encoding:'utf8'});
  assert.notEqual(invalid.status,0);
});

test('changing only the shared policy refreshes every prompt and both evidence adapters',()=>{
  // Keep fixtures for inspection; never mutate the real policy or any reports.
  const fixture=mkdtempSync(join(tmpdir(),'hema-material-policy-'));
  for(const file of ['report-format.json','report-format.mjs','editorial.mjs','editorial-workflow.mjs','store.mjs','draft-sections.mjs','result-ready.mjs']) {
    copyFileSync(new URL('./'+file,import.meta.url),join(fixture,file));
  }
  const probe=`
    import {createHash} from 'node:crypto';
    const base=process.argv[1];
    const p=await import(new URL('report-format.mjs',base));
    const e=await import(new URL('editorial.mjs',base));
    const r=await import(new URL('editorial-workflow.mjs',base));
    const digest=s=>createHash('sha256').update(s).digest('hex');
    const oldDraft=JSON.parse(process.argv[2]);
    let staleChecksAccepted=true;
    try { e.validateEditorial(oldDraft,JSON.parse(process.argv[3])); } catch { staleChecksAccepted=false; }
    console.log(JSON.stringify({identity:p.materialPolicyIdentity,checks:p.fidelityChecks,staleChecksAccepted,
      prompts:[e.editorialInstructions,r.reviewInstructions,r.readerInstructions,r.targetedRepairInstructions].map(digest)}));`;
  const read=()=>{
    const result=spawnSync(process.execPath,['--input-type=module','-e',probe,pathToFileURL(fixture+'/').href,JSON.stringify(draft()),JSON.stringify(transcript)],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    return JSON.parse(result.stdout);
  };
  const before=read();
  assert.equal(before.staleChecksAccepted,true);
  const policyPath=join(fixture,'report-format.json');
  const policy=JSON.parse(readFileSync(policyPath,'utf8'));
  policy.material_policy.common.push('Изолированное дополнительное правило контрольного контракта.');
  policy.material_policy.checks.push({id:'fixture_extra',rule:'Дополнительное измерение только для теста.'});
  writeFileSync(policyPath,JSON.stringify(policy));
  const after=read();
  assert.equal(after.identity.version,before.identity.version);
  assert.notEqual(after.identity.sha256,before.identity.sha256);
  assert.equal(after.staleChecksAccepted,false);
  assert.ok(after.checks.includes('fixture_extra'));
  after.prompts.forEach((digest,index)=>assert.notEqual(digest,before.prompts[index]));
  const schema=spawnSync(process.execPath,[join(fixture,'report-format.mjs'),'schema'],{encoding:'utf8'});
  assert.equal(schema.status,0,schema.stderr);
  const local=JSON.parse(schema.stdout);
  assert.deepEqual(local.material_policy_identity,after.identity);
  assert.deepEqual(local.material_policy.checks.map(check=>check.id),after.checks);
});

test('successful cloud review records actual policy and transcript-only basis',async()=>{
  const result=await reviewAndImprove(validateEditorial(draft(),transcript),transcript,[],async name=>({
    value:name.startsWith('reader-audit')?{chapters:[{issues:[]}],exercises:[]}:{pass:true,issues:[],notes:''}
  }));
  assert.equal(result.review.pass,true);
  assert.deepEqual(result.review.material_policy,materialPolicyIdentity);
  assert.equal(result.review.basis,'transcript-only');
});

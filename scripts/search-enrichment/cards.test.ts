import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {validateCards,cardCoverage} from './cards.mjs';
import {execFileSync} from 'node:child_process';
import {sourceFor,sourceHash} from './core.mjs';
import {techniqueAliases} from '$lib/search-techniques';
import rules from '../../src/lib/data/search-term-rules.json';
import dictionary from '../../src/lib/data/hema-search-dictionary.json';

const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
it('distinguishes missing, partial and complete preparation and preserves dry-run input',()=>{
 const slug='sablya-a-3',report=read(`src/lib/data/reports/${slug}.json`),cards=read(`src/lib/data/search-cards/${slug}.json`);
 expect(cardCoverage(report,{...cards,cards:cards.cards.slice(0,3)})).toMatchObject({status:'partial',covered:3,total:10});
 const coverage=cardCoverage(report,cards);
 expect(coverage.covered+coverage.missing.length).toBe(10);
 expect(cardCoverage(report,null)).toMatchObject({status:'missing',covered:0});
 const output=execFileSync(process.execPath,['scripts/search-enrichment/cards-cli.mjs','status',slug],{encoding:'utf8'});
 expect(JSON.parse(output).coverage).toEqual(coverage);
 const requireComplete=()=>execFileSync(process.execPath,['scripts/search-enrichment/cards-cli.mjs','status',slug,'--require-complete'],{encoding:'utf8',stdio:'pipe'});
 if(coverage.status==='complete')expect(JSON.parse(requireComplete()).ok).toBe(true);
 else expect(requireComplete).toThrow();
 const before=readFileSync(`src/lib/data/search-cards/${slug}.json`,'utf8');
 const dry=execFileSync(process.execPath,['scripts/search-enrichment/cards-cli.mjs','import',slug,`src/lib/data/search-cards/${slug}.json`,'--dry-run'],{encoding:'utf8'});
 expect(JSON.parse(dry).dryRun).toBe(true);
 expect(readFileSync(`src/lib/data/search-cards/${slug}.json`,'utf8')).toBe(before);
});
it('validates all pilot cards and rejects source/dictionary drift and fabricated citations',()=>{
 const specs=read('scripts/search-enrichment/pilot-card-spec.json');
 for(const spec of specs){
  const r=read(`src/lib/data/reports/${spec.slug}.json`),d=read(`src/lib/data/search-cards/${spec.slug}.json`);
  expect(validateCards(r,d)).toBe(d);

  const stale=structuredClone(r);stale.chapters[d.cards[0].chapterIndex].summary+=' changed';
  expect(()=>validateCards(stale,d)).toThrow('Stale card source');
  expect(()=>validateCards(r,{...d,dictionarySha256:'old'})).toThrow('Stale card dictionary');
  const bad=structuredClone(d);bad.cards[0].action={text:'Invented',evidence:'This invented quote is not in the source.'};
  expect(()=>validateCards(r,bad)).toThrow('Ungrounded');
 }
});
it('checks rule provenance, canonical edges, and negative triggers',()=>{
 expect(rules.sourceSha256).toBe(dictionary.sourceSha256);
 for(const g of rules.groups){
  const e=dictionary.entries.find(e=>e.id===g.canonicalId)!;
  expect(e).toBeDefined();
  for(const edge of g.relations){
   expect(edge.type==='asr'?e.asr_variants:e.aliases).toContain(edge.from);
   expect(e.aliases).toContain(edge.to);
   expect(techniqueAliases(edge.from).length).toBeGreaterThan(0);
  }
  for(const q of g.negative)expect(techniqueAliases(q)).toEqual([]);
 }
});
it('freezes registry and verifies all judgments against their source chapters',()=>{
 const raw=readFileSync('scripts/search-enrichment/pilot-registry.json','utf8');
 expect(createHash('sha256').update(raw).digest('hex')).toBe(readFileSync('scripts/search-enrichment/pilot-registry.sha256','utf8').trim());
 const d=JSON.parse(raw);expect(d.cases).toHaveLength(60);
 expect(d.cases.filter((c:any)=>c.split==='holdout')).toHaveLength(20);
 expect(d.cases.filter((c:any)=>c.kind==='unsupported')).toHaveLength(12);
 expect(d.cases.filter((c:any)=>c.kind==='multi')).toHaveLength(8);
 for(const q of d.cases){
  if(q.kind==='multi')expect(new Set(q.judgments.map((j:any)=>j.reportSlug)).size).toBeGreaterThan(1);
  if(q.kind==='unsupported')expect(q.missingInformation.length).toBeGreaterThan(20);
  for(const j of q.judgments){const r=read(`src/lib/data/reports/${j.reportSlug}.json`);
   expect(r.chapters[j.chapterIndex].summary).toBe(j.evidence);
   expect(sourceHash(sourceFor(r,j.chapterIndex))).toBe(j.sourceHash);
  }
 }
});

it('preserves the expanded experiment and verifies its balanced families and sources',()=>{
 const raw=readFileSync('scripts/search-enrichment/pilot-expanded.json','utf8');
 expect(createHash('sha256').update(raw).digest('hex')).toBe(readFileSync('scripts/search-enrichment/pilot-expanded.sha256','utf8').trim());
 const registry=JSON.parse(raw);
 expect(registry.cases).toHaveLength(56);
 const single=registry.cases.filter((q:any)=>q.kind==='single');
 expect(new Set(single.map((q:any)=>q.familyId)).size).toBe(24);
 expect(single.filter((q:any)=>q.variant==='typo')).toHaveLength(24);
 const specs=read('scripts/search-enrichment/pilot-expanded-card-spec.json');
 for(const spec of specs){
  const r=read(`src/lib/data/reports/${spec.slug}.json`);
  expect(new Set(spec.cards.map((c:any)=>c.i)).size).toBe(r.chapters.length);
  expect(single.filter((q:any)=>q.judgments[0].reportSlug===spec.slug)).toHaveLength(6);
 }
 for(const q of registry.cases)for(const j of q.judgments){
  const r=read(`src/lib/data/reports/${j.reportSlug}.json`);
  expect(r.chapters[j.chapterIndex].summary).toBe(j.evidence);
  expect(sourceHash(sourceFor(r,j.chapterIndex))).toBe(j.sourceHash);
 }
});

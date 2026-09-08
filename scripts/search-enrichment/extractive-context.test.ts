import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {extractiveContext,CONTEXT_PROMPT_VERSION} from './extractive-context.mjs';
import {validateCards} from './cards.mjs';
import {sourceFor,sourceHash} from './core.mjs';
import {dictionaryProvenance} from './dictionary.mjs';
import {runCardsCommand} from './cards-cli.mjs';
import {auditCards} from './audit.mjs';
it('prepares without replacing reviewed cards and regenerates literal context after source edits',()=>{
 const root=mkdtempSync(join(tmpdir(),'wisper-context-'));
 try{
  const slug='tenouti-i-tyakin-sibori',dir=join(root,'src/lib/data/reports');mkdirSync(dir,{recursive:true});
  const r=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
  const path=join(dir,slug+'.json');writeFileSync(path,JSON.stringify(r));
  const dry=runCardsCommand(root,['prepare-context',slug,'--dry-run']);
  expect(existsSync(dry.artifacts[0].path)).toBe(false);
  const candidate=runCardsCommand(root,['prepare-context',slug]).artifacts[0].path;
  const target=join(root,'src/lib/data/search-cards',slug+'.json');
  runCardsCommand(root,['import',slug,candidate,'--dry-run']);expect(existsSync(target)).toBe(false);
  runCardsCommand(root,['import',slug,candidate]);const before=readFileSync(target,'utf8');
  r.chapters[4].title+=' — уточнение';writeFileSync(path,JSON.stringify(r));
  expect(auditCards(root,slug)).toMatchObject({status:'stale',stale:[4],sourceMode:'extractive-context'});
  expect(()=>runCardsCommand(root,['import',slug,candidate])).toThrow('Stale');
  runCardsCommand(root,['prepare-context',slug]);expect(readFileSync(target,'utf8')).toBe(before);
  runCardsCommand(root,['import',slug,candidate]);
  expect(auditCards(root,slug).status).toBe('complete');
  const after=JSON.parse(readFileSync(target,'utf8'));
  expect(after.cards[3]).toEqual(JSON.parse(before).cards[3]);
  expect(after.cards[4].context.text).toContain('уточнение');
 }finally{rmSync(root,{recursive:true,force:true});}
});
it('requires literal context, current source and explicit extractive provenance',()=>{
 const r=JSON.parse(readFileSync('src/lib/data/reports/tenouti-i-tyakin-sibori.json','utf8'));
 const d={version:1,sourceMode:'extractive-context',reportSlug:r.slug,promptVersion:CONTEXT_PROMPT_VERSION,dictionarySha256:dictionaryProvenance.sourceSha256,generator:'extractive-context-v1',cards:[{chapterIndex:4,sourceHash:sourceHash(sourceFor(r,4)),termIds:[],context:extractiveContext(r,4)}]};
 expect(validateCards(r,d)).toBe(d);
 const altered=structuredClone(d);altered.cards[0].context.text+=' invented';
 expect(()=>validateCards(r,altered)).toThrow('Nonliteral');
 expect(()=>validateCards({...r,title:r.title+' changed'},d)).toThrow('Stale card source');
 expect(()=>validateCards(r,{...d,sourceMode:undefined})).toThrow('prompt');
 const inferred=structuredClone(d);(inferred.cards[0].termIds as string[]).push('invented');
 expect(()=>validateCards(r,inferred)).toThrow('cannot infer');
 const fabricated=structuredClone(d);fabricated.cards[0].context.evidence='This quote is fabricated';
 expect(()=>validateCards(r,fabricated)).toThrow('Ungrounded');
});

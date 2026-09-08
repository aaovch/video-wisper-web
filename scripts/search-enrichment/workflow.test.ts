import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {join,dirname,basename,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {afterEach,expect,it} from 'vitest';
import {runCardsCommand} from './cards-cli.mjs';
import {auditSearchCards,auditCards} from './audit.mjs';
import {sourceFor,sourceHash} from './core.mjs';
import {readCards} from './cards.mjs';
const roots:string[]=[];
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const write=(p:string,d:any)=>writeFileSync(p,JSON.stringify(d,null,2)+'\n');
function workspace(slugs:string[]){
 const root=mkdtempSync(join(tmpdir(),'video-wisper-search-'));roots.push(root);
 mkdirSync(join(root,'src/lib/data/reports'),{recursive:true});
 for(const s of slugs){
  const report=read(`src/lib/data/reports/${s}.json`);
  // These cases exercise legacy optional reports; required mode has its own test.
  delete report.search_cards_required;
  write(join(root,'src/lib/data/reports',s+'.json'),report);
 }
 return root;
}
afterEach(()=>{for(const root of roots.splice(0)){
 // Only remove the exact temporary workspace created by this test.
 if(dirname(resolve(root))!==resolve(tmpdir())||!basename(root).startsWith('video-wisper-search-'))throw Error('Unsafe test cleanup');
 rmSync(root,{recursive:true,force:true});
}});
it('prepares and imports two new sidecars, detects a source edit and recovers only after a reviewed replacement',()=>{
 const slugs=['sablya-a-3','2026-07-06-19-26-42'],root=workspace(slugs);
 expect(auditSearchCards(root).summary.missing).toBe(2);
 expect(auditSearchCards(root,'--all',true).ok).toBe(false);
 for(const slug of slugs){
  const dry=runCardsCommand(root,['prepare',slug,'--dry-run']);
  expect(existsSync(dry.artifacts[0].path)).toBe(false);
  const prepared=runCardsCommand(root,['prepare',slug]);
  const pack=read(prepared.artifacts[0].path);
  expect(pack.chapters.every((c:any)=>c.sourceHash&&Array.isArray(c.dictionaryHints))).toBe(true);
  const candidate=join(root,slug+'.candidate.json');write(candidate,read(`src/lib/data/search-cards/${slug}.json`));
  const preview=runCardsCommand(root,['import',slug,candidate,'--dry-run']);
  expect(existsSync(preview.artifacts[0].path)).toBe(false);
  runCardsCommand(root,['import',slug,candidate]);
 }
 expect(auditSearchCards(root,'--all',true).ok).toBe(true);
 const slug=slugs[0],path=join(root,'src/lib/data/reports',slug+'.json'),report=read(path);
 report.chapters[0].summary='Обновлённое описание темы занятия: действия против оружия соперника.';write(path,report);
 const stale=auditCards(root,slug);
 expect(stale.status).toBe('stale');expect(stale.recovery.chapterIndices).toEqual([0]);
 expect(auditSearchCards(root).ok).toBe(false);
 const target=join(root,'src/lib/data/search-cards',slug+'.json'),before=readFileSync(target,'utf8');
 expect(()=>runCardsCommand(root,['import',slug,join(root,slug+'.candidate.json')])).toThrow('Stale card source');
 expect(readFileSync(target,'utf8')).toBe(before);
 const candidate=JSON.parse(before),card=candidate.cards.find((c:any)=>c.chapterIndex===0);
 card.sourceHash=sourceHash(sourceFor(report,0));
 card.situation={text:report.chapters[0].summary,evidence:report.chapters[0].summary};
 const replacement=join(root,'replacement.json');write(replacement,candidate);
 runCardsCommand(root,['import',slug,replacement,'--dry-run']);expect(readFileSync(target,'utf8')).toBe(before);
 runCardsCommand(root,['import',slug,replacement]);
 expect(auditSearchCards(root,'--all',true).ok).toBe(true);
 expect(read(target).cards.slice(1)).toEqual(JSON.parse(before).cards.slice(1));
});
it('enforces a report requirement in ordinary audit and index loading',()=>{
 const slug='sablya-a-3',root=workspace([slug]);
 const path=join(root,'src/lib/data/reports',slug+'.json'),report=read(path);
 report.search_cards_required=true;write(path,report);
 expect(auditSearchCards(root).ok).toBe(false);
 expect(()=>readCards(root,report)).toThrow('Required search cards incomplete');
 const candidate=read(`src/lib/data/search-cards/${slug}.json`),file=join(root,'candidate.json');
 write(file,{...candidate,cards:candidate.cards.slice(0,1)});
 runCardsCommand(root,['import',slug,file]);
 expect(auditSearchCards(root).ok).toBe(false);
 expect(()=>readCards(root,report)).toThrow('Required search cards incomplete');
 write(file,candidate);runCardsCommand(root,['import',slug,file]);
 expect(auditSearchCards(root).ok).toBe(true);
 expect(readCards(root,report)).toEqual(candidate);
 report.search_cards_required='yes';write(path,report);
 expect(auditCards(root,slug).status).toBe('invalid');
 expect(()=>readCards(root,report)).toThrow('Invalid search_cards_required');
});
it('reports partial coverage, dictionary drift, malformed data and orphan sidecars without hiding failures',()=>{
 const slug='sablya-a-3',root=workspace([slug]),candidate=read(`src/lib/data/search-cards/${slug}.json`);
 const dir=join(root,'src/lib/data/search-cards');mkdirSync(dir,{recursive:true});
 const path=join(dir,slug+'.json');candidate.cards=candidate.cards.slice(0,2);write(path,candidate);
 expect(auditCards(root,slug)).toMatchObject({status:'partial',covered:2,total:10});
 expect(auditSearchCards(root).ok).toBe(true);expect(auditSearchCards(root,slug,true).ok).toBe(false);
 candidate.dictionarySha256='old';write(path,candidate);
 expect(auditCards(root,slug)).toMatchObject({status:'stale',dictionaryChanged:true,stale:[0,1]});
 expect(auditCards(root,slug).recovery.chapterIndices).toHaveLength(10);
 writeFileSync(path,'{broken');expect(auditCards(root,slug).status).toBe('invalid');
 write(join(dir,'missing-report.json'),candidate);
 expect(auditSearchCards(root).summary.invalid).toBe(2);
});

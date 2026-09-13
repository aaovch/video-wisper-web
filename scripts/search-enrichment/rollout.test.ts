import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {collections} from '$lib/data/collections';
import {auditCards} from './audit.mjs';
it('requires current search preparation for every fencing collection including archived and gated reports',()=>{
 const slugs=new Set(collections.filter(c=>c.hema).flatMap(c=>c.items));
 expect(slugs.size).toBeGreaterThanOrEqual(118);
 for(const slug of slugs){
  const report=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
  expect(report.search_cards_required,slug).toBe(true);
  expect(auditCards(process.cwd(),slug),slug).toMatchObject({status:'complete',missing:[],stale:[]});
 }
},10_000);
it('keeps the selected fencing collections fully indexed as membership changes',()=>{
 for(const slug of ['almaty-2026','noname-training']){
  const collection=collections.find(c=>c.slug===slug);
  expect(collection,slug).toBeDefined();
  for(const reportSlug of collection!.items){
   const report=JSON.parse(readFileSync(`src/lib/data/reports/${reportSlug}.json`,'utf8'));
   expect(report.search_cards_required,reportSlug).toBe(true);
   expect(auditCards(process.cwd(),reportSlug),reportSlug).toMatchObject({status:'complete',missing:[],stale:[]});
  }
 }
});
it('keeps the consolidated NoName training collection canonical while retaining legacy routes',()=>{
 const collection=collections.find(c=>c.slug==='noname-training')!;
 expect(collection.sections?.map(section=>[section.title,section.items.length])).toEqual([
  ['Длинный меч',2],['Меч и баклер',1],['Спарринги',1]
 ]);
 for(const slug of ['dlinnyy-mech-basic-noname','mezotsikl-1-dlinnyy-mech-noname','mech-i-bakler-noname','noname-sparring']){
  expect(collections.find(c=>c.slug===slug)?.catalogHidden,slug).toBe(true);
 }
});
it('keeps both NoName weapon sections complete without claiming the other sections are covered',()=>{
 const collection=collections.find(c=>c.slug==='noname')!;
 for(const title of ['Меч Пети','Сабля Саши']){
  const section=collection.sections?.find(s=>s.title===title);
  expect(section,title).toBeDefined();expect(section!.items.length).toBeGreaterThan(0);
  for(const slug of section!.items){
   const report=JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`,'utf8'));
   expect(report.search_cards_required,slug).toBe(true);
   expect(auditCards(process.cwd(),slug),slug).toMatchObject({status:'complete',missing:[],stale:[]});
  }
 }
});

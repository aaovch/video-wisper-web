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
});
it('keeps the selected fencing collections fully indexed as membership changes',()=>{
 for(const slug of ['almaty-2026','dlinnyy-mech-basic-noname','mech-i-bakler-noname']){
  const collection=collections.find(c=>c.slug===slug);
  expect(collection,slug).toBeDefined();
  for(const reportSlug of collection!.items){
   const report=JSON.parse(readFileSync(`src/lib/data/reports/${reportSlug}.json`,'utf8'));
   expect(report.search_cards_required,reportSlug).toBe(true);
   expect(auditCards(process.cwd(),reportSlug),reportSlug).toMatchObject({status:'complete',missing:[],stale:[]});
  }
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

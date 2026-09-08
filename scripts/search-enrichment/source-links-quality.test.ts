import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import {searchScoped,resetSearchIndex,whenSearchComplete} from '$lib/search-core';
import {searchableReportSlugs} from '$lib/search-visibility';
import {relatedSources} from '$lib/search-source-links';
import {searchHitKey} from '$lib/search-hit-key';
import {collections} from '$lib/data/collections';
import type {SearchScope} from '$lib/search-types';
it('measures linked-source access separately from direct top-five retrieval',async()=>{
 const files=new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(n=>[n,readFileSync(`static/search/${n}`,'utf8')]));
 const visible=searchableReportSlugs([],'all'),rows:any[]=[],diagnostics:any[]=[];
 const indexedChapters=new Set(Object.values(JSON.parse(files.get('index-core.json')!).storedFields).map((d:any)=>`${d.reportSlug}:${d.chapterIndex}`));
 const confirmation=JSON.parse(readFileSync('scripts/search-enrichment/source-link-questions.json','utf8'));
 const frozen=readFileSync('scripts/search-enrichment/source-links-v1.json');
 expect(createHash('sha256').update(frozen).digest('hex')).toBe(confirmation.graphHash);
 const current=readFileSync('src/lib/data/search-source-links.json');
 expect(JSON.parse(current.toString()).links.slice(0,4)).toEqual(JSON.parse(frozen.toString()).links);
 const next=JSON.parse(readFileSync('scripts/search-enrichment/source-link-questions-v2.json','utf8'));
 expect(createHash('sha256').update(current).digest('hex')).toBe(next.graphHash);
 const cases=[...['pilot-registry','pilot-expanded','noname-registry'].flatMap(name=>JSON.parse(readFileSync(`scripts/search-enrichment/${name}.json`,'utf8')).cases).filter(q=>q.kind==='multi'),...confirmation.cases,...next.cases];
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(files.get(String(url).split('/').pop()!))));
 try{
  vi.stubEnv('VITE_SEARCH_CANDIDATE_LIMIT','0');
  resetSearchIndex();await whenSearchComplete();
  for(const q of cases){
   const scopes:SearchScope[]=[{kind:'archive',label:'archive',reportSlugs:visible}];
   if(q.scopes.includes('report'))scopes.push({kind:'report',label:q.judgments[0].reportSlug,reportSlug:q.judgments[0].reportSlug});
   if(q.scopes.includes('collection'))for(const c of collections.filter(c=>!c.password&&c.items.includes(q.judgments[0].reportSlug)&&(!q.sharedCollectionsOnly||q.judgments.every((j:any)=>c.items.includes(j.reportSlug)))))scopes.push({kind:'collection',label:c.slug,reportSlugs:c.items.filter(s=>visible.includes(s))});
   for(const scope of scopes){
    const result=await searchScoped(q.query,[scope],scope.kind==='archive'?30:120),seen=new Set<string>();
    const ranked=result.hits.filter(h=>{const k=searchHitKey(h);if(seen.has(k))return false;seen.add(k);return true;});
    const hits=ranked.slice(0,5);
    const keys=new Set(hits.filter(h=>h.chapterIndex!=null).map(h=>`${h.reportSlug}:${h.chapterIndex}`));
    const expanded=new Set(keys);
    for(const hit of hits)for(const link of relatedSources(hit,scope)){
     expect((scope.kind==='report'?[scope.reportSlug]:scope.reportSlugs).includes(link.reportSlug)).toBe(true);
     expanded.add(`${link.reportSlug}:${link.chapterIndex}`);
    }
    const expected=q.judgments.filter((j:any)=>j.grade===3).map((j:any)=>`${j.reportSlug}:${j.chapterIndex}`);
    const allowed=new Set(scope.kind==='report'?[scope.reportSlug]:scope.reportSlugs);
    for(const j of q.judgments.filter((j:any)=>j.grade===3)){
     const key=`${j.reportSlug}:${j.chapterIndex}`;
     expect(indexedChapters.has(key),`Expected chapter missing from core index: ${key}`).toBe(true);
     if(!allowed.has(j.reportSlug)){expect(keys.has(key)).toBe(false);expect(expanded.has(key)).toBe(false);}
    }
    rows.push({id:q.id,scope:scope.kind,label:scope.label,direct:expected.filter((k:string)=>keys.has(k)).length,withLinks:expected.filter((k:string)=>expanded.has(k)).length,expected:expected.length});
    if(process.env.SOURCE_LINKS_DIAGNOSE){
     let deeper;
     vi.stubEnv('VITE_SEARCH_CANDIDATE_LIMIT','120');
     try{deeper=await searchScoped(q.query,[scope],120);}
     finally{vi.stubEnv('VITE_SEARCH_CANDIDATE_LIMIT','0');}
     const deepSeen=new Set<string>();
     const deepHits=deeper.hits.filter(h=>{const k=searchHitKey(h);if(deepSeen.has(k))return false;deepSeen.add(k);return true;});
     for(const j of q.judgments.filter((j:any)=>j.grade===3)){
      const key=`${j.reportSlug}:${j.chapterIndex}`;
      const rank=ranked.findIndex(h=>h.reportSlug===j.reportSlug&&h.chapterIndex===j.chapterIndex)+1;
      const deepRank=deepHits.findIndex(h=>h.reportSlug===j.reportSlug&&h.chapterIndex===j.chapterIndex)+1;
      const inScope=allowed.has(j.reportSlug);
      if(!inScope){expect(keys.has(key)).toBe(false);expect(expanded.has(key)).toBe(false);}
      diagnostics.push({id:q.id,query:q.query,scope:scope.kind,label:scope.label,source:key,inScope,rank:rank||null,diagnosticRank120:deepRank||null,status:!inScope?'outside-scope':keys.has(key)?'direct':expanded.has(key)?'linked':rank?'below-top-five':deepRank?'deeper-candidate':'absent-from-120',topFive:hits.map(h=>({source:`${h.reportSlug}:${h.chapterIndex}`,title:h.title,kind:h.kind}))});
     }
    }
   }
  }
  const gains=rows.filter(r=>r.withLinks>r.direct);
  expect(gains.length).toBeGreaterThan(0);
  if(process.env.SOURCE_LINKS_DIAGNOSE){
   const counts=Object.fromEntries([...new Set(diagnostics.map(r=>r.status))].map(status=>[status,diagnostics.filter(r=>r.status===status).length]));
   writeFileSync('docs/search-quality/source-links-diagnostics.json',JSON.stringify({protocol:'Disclosed diagnostic. Original 84-source denominator preserved in evaluation. Scope exclusions are not retrieval failures. Rank120 is a separate diagnostic run, not production ranking.',indexHash:createHash('sha256').update([...files.values()].join('')).digest('hex'),graphHash:createHash('sha256').update(current).digest('hex'),counts,rows:diagnostics},null,2)+'\n');
  }
  const accepted=JSON.parse(readFileSync('scripts/search-enrichment/source-links-regressions.json','utf8'));
  for(const baseline of accepted.rows){
   const actual=rows.find(r=>r.id===baseline.id&&r.scope===baseline.scope&&r.label===baseline.label);
   expect(actual,`${baseline.id}/${baseline.label}`).toBeDefined();
   expect(actual.expected).toBe(baseline.expected);
   expect(actual.direct).toBeGreaterThanOrEqual(baseline.direct);
   expect(actual.withLinks).toBeGreaterThanOrEqual(baseline.withLinks);
  }
  if(process.env.SOURCE_LINKS_EVAL)writeFileSync('docs/search-quality/source-links-evaluation.json',JSON.stringify({protocol:'Disclosed source-aware pilot; links are a separate one-click navigation path, not direct top-five retrieval or generated answers.',indexHash:createHash('sha256').update([...files.values()].join('')).digest('hex'),graphHash:createHash('sha256').update(readFileSync('src/lib/data/search-source-links.json')).digest('hex'),scenarios:rows.length,directCoverage:rows.reduce((s,r)=>s+r.direct/r.expected,0)/rows.length,linkedCoverage:rows.reduce((s,r)=>s+r.withLinks/r.expected,0)/rows.length,gains,rows},null,2)+'\n');
 }finally{resetSearchIndex();vi.unstubAllGlobals();vi.unstubAllEnvs();}
},60000);

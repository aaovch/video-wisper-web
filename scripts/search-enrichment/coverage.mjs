import {readFileSync,writeFileSync} from 'node:fs';
import {auditCards} from './audit.mjs';
export function fencingCoverage(root=process.cwd()){
 const collections=JSON.parse(readFileSync(`${root}/src/lib/data/collections.json`,'utf8')).filter(c=>c.hema);
 const reports=[...new Set(collections.flatMap(c=>c.items))].map(slug=>auditCards(root,slug));
 return {collections:collections.map(c=>({slug:c.slug,archived:!!c.archived,reports:c.items.length,complete:c.items.filter(s=>reports.find(r=>r.slug===s)?.status==='complete').length})),reports,total:reports.length,complete:reports.filter(r=>r.status==='complete').length,missing:reports.filter(r=>r.status!=='complete').map(r=>({slug:r.slug,chapters:r.total,status:r.status}))};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/coverage.mjs')){
 const data=fencingCoverage();if(process.argv.includes('--save'))writeFileSync('docs/search-quality/fencing-coverage.json',JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({...data,reports:undefined},null,2));
}

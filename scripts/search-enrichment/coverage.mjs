import ts from 'typescript';
import {readFileSync,writeFileSync} from 'node:fs';
import {auditCards} from './audit.mjs';
// Read the canonical literal collection list without importing application modules.
export function fencingCoverage(root=process.cwd()){
 const file=ts.createSourceFile('collections.ts',readFileSync(`${root}/src/lib/data/collections.ts`,'utf8'),ts.ScriptTarget.Latest,true);
 let array;
 function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(file)==='collections')array=n.initializer;ts.forEachChild(n,walk);}walk(file);
 if(!array||!ts.isArrayLiteralExpression(array))throw Error('Expected collection array');
 function literal(n){
  if(ts.isStringLiteralLike(n))return n.text;
  if(n.kind===ts.SyntaxKind.TrueKeyword)return true;
  if(n.kind===ts.SyntaxKind.FalseKeyword)return false;
  if(ts.isArrayLiteralExpression(n))return n.elements.map(literal);
  if(ts.isObjectLiteralExpression(n))return Object.fromEntries(n.properties.map(p=>{if(!ts.isPropertyAssignment(p))throw Error('Nonliteral collection');return [p.name.getText(file).replace(/^['"]|['"]$/g,''),literal(p.initializer)];}));
  throw Error(`Unsupported collection value: ${n.getText(file).slice(0,40)}`);
 }
 const collections=literal(array).filter(c=>c.hema);
 const reports=[...new Set(collections.flatMap(c=>c.items))].map(slug=>auditCards(root,slug));
 return {collections:collections.map(c=>({slug:c.slug,archived:!!c.archived,reports:c.items.length,complete:c.items.filter(s=>reports.find(r=>r.slug===s)?.status==='complete').length})),reports,total:reports.length,complete:reports.filter(r=>r.status==='complete').length,missing:reports.filter(r=>r.status!=='complete').map(r=>({slug:r.slug,chapters:r.total,status:r.status}))};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/coverage.mjs')){
 const data=fencingCoverage();if(process.argv.includes('--save'))writeFileSync('docs/search-quality/fencing-coverage.json',JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({...data,reports:undefined},null,2));
}

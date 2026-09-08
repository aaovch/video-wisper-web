// Actual Python CLI -> new reports -> Node card workflow -> changed report.
// Uses cached real sources in a fresh workspace; never alters original transcripts.
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,cpSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {runCardsCommand} from './cards-cli.mjs';
import {auditSearchCards,auditCards} from './audit.mjs';
import {sourceFor,sourceHash} from './core.mjs';
const root=resolve('.'),pipeline=resolve('..'),project=mkdtempSync(join(tmpdir(),'video-wisper-lifecycle-'));
const site=join(project,'video-wisper-web');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const cases=[['6p-xz8TZ_t4','mech-i-bakler-mikrotsikl-1-osnovy'],['-36154431_456239279','prostaya-ataka-mikrotsikl-1-dlinnyy-mech']];
const proof={workspace:project,kind:'cached-real-source-replay',newReports:[],changedReport:null};
mkdirSync(join(project,'output'),{recursive:true});
function build(stem,slug,spec,flags=[]){
 const result=spawnSync(join(pipeline,'.venv/Scripts/python.exe'),['-X','utf8','-m','src.tooling','build-report',`--stem=${stem}`,'--slug',slug,'--chapters',spec,'--project-root',project,'--format','json',...flags],{cwd:pipeline,encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
 const data=JSON.parse(result.stdout);assert.equal(data.ok,true);return data;
}
for(const [stem,slug]of cases){
 cpSync(join(pipeline,'output',stem),join(project,'output',stem),{recursive:true,filter:p=>!p.endsWith('.mp4')&&!p.endsWith('.mp3')&&!p.endsWith('.wav')});
 const spec=join(project,slug+'.spec.json');cpSync(join(pipeline,'data/jobs',stem,'report-spec.json'),spec);
 const dry=build(stem,slug,spec,['--require-search-cards','--dry-run']);
 assert(dry.artifacts.every(a=>!existsSync(a.path)));
 const created=build(stem,slug,spec,['--require-search-cards']);
 assert.equal(created.data.search_cards_required,true);
 assert.equal(auditSearchCards(site).ok,false);
 const report=read(join(site,'src/lib/data/reports',slug+'.json'));
 const original=read(join(root,'src/lib/data/reports',slug+'.json'));
 // Exact source equivalence allows the already reviewed real cards to be reused.
 report.chapters.forEach((_,i)=>assert.equal(sourceHash(sourceFor(report,i)),sourceHash(sourceFor(original,i))));
 const pack=runCardsCommand(site,['prepare',slug,'--dry-run']);assert(!existsSync(pack.artifacts[0].path));
 runCardsCommand(site,['prepare',slug]);
 const candidate=join(root,'src/lib/data/search-cards',slug+'.json');
 const preview=runCardsCommand(site,['import',slug,candidate,'--dry-run']);assert(!existsSync(preview.artifacts[0].path));
 runCardsCommand(site,['import',slug,candidate]);
 assert.equal(auditCards(site,slug).status,'complete');
 const repeated=build(stem,slug,spec);assert(repeated.artifacts.every(a=>a.action==='unchanged'));
 proof.newReports.push({slug,chapters:report.chapters.length,dryRun:true,complete:true,idempotent:true,requirementPreserved:true});
}
const [stem,slug]=cases[1],specPath=join(project,slug+'.spec.json'),spec=read(specPath);
// Source-reviewed rephrasing of the introductory chapter, preserving its claim.
spec.chapters[0].summary='Пётр Васильев знакомит группу с совместной работой тренеров NoName; перед темой простой атаки предусмотрен короткий разогрев.';
write(specPath,spec);build(stem,slug,specPath,['--dry-run']);build(stem,slug,specPath);
assert.equal(auditSearchCards(site).ok,false);assert.deepEqual(auditCards(site,slug).stale,[0]);
const old=join(root,'src/lib/data/search-cards',slug+'.json');
assert.throws(()=>runCardsCommand(site,['import',slug,old]),/Stale card source/);
const replacement=read(old),report=read(join(site,'src/lib/data/reports',slug+'.json'));
replacement.cards[0]={chapterIndex:0,sourceHash:sourceHash(sourceFor(report,0)),termIds:[],situation:{text:'Знакомство с работой тренеров NoName и разогрев перед изучением простой атаки.',evidence:report.chapters[0].summary}};
const candidate=join(project,'reviewed-replacement.json');write(candidate,replacement);
runCardsCommand(site,['import',slug,candidate,'--dry-run']);runCardsCommand(site,['import',slug,candidate]);
assert.deepEqual(replacement.cards.slice(1),read(old).cards.slice(1));
assert.equal(auditSearchCards(site).ok,true);
proof.changedReport={slug,staleDetected:true,oldImportRejected:true,reviewedRecovery:true,unchangedCardsPreserved:true};
write(join(root,'docs/search-quality/lifecycle.json'),proof);
console.log(JSON.stringify(proof,null,2));

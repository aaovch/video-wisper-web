import { readFileSync, writeFileSync } from 'node:fs';
import { metrics } from '../search-lab/lexical.mjs';
import { sourceHash } from './core.mjs';

const beforePath = process.argv[2] ?? '.codex/search-enrichment/runtime-before.json';
const afterPath = process.argv[3] ?? '.codex/search-lab/tasks.json';
const before = JSON.parse(readFileSync(beforePath, 'utf8'));
const after = JSON.parse(readFileSync(afterPath, 'utf8'));
const identity = task => ({ id:task.id, query:task.query, allowed:task.allowed, relevant:task.relevant, variant:task.variant, scope:task.scope });
if (sourceHash(before.map(identity)) !== sourceHash(after.map(identity))) throw new Error('Cannot compare different evaluation tasks');
const differences = [];
const groups = [];
for (const scope of ['report','collection','archive']) {
	const group = {scope, count:0, beforeHit3:0, afterHit3:0, beforeHit5:0, afterHit5:0, negativeCount:0, beforeNonempty:0, afterNonempty:0};
	for (let i=0;i<before.length;i++) {
		const a=before[i], b=after[i];
		if(a.scope!==scope) continue;
		const ma=metrics(a.rankings.current,a.relevant), mb=metrics(b.rankings.current,b.relevant);
		if (!a.relevant.length) {
			group.negativeCount++;
			group.beforeNonempty+=+(a.rankings.current.length>0); group.afterNonempty+=+(b.rankings.current.length>0);
			continue;
		}
		group.count++; group.beforeHit3+=ma.hit3; group.afterHit3+=mb.hit3; group.beforeHit5+=ma.hit5; group.afterHit5+=mb.hit5;
		if(ma.rank!==mb.rank) differences.push({id:a.id,query:a.query,scope,beforeRank:ma.rank,afterRank:mb.rank});
	}
	groups.push(group);
}
const output = {beforeHash:sourceHash(before), afterHash:sourceHash(after), protocol:'Existing exploratory questions, actual searchScoped with UI deduplication; same queries, scopes and qrels. Rank 0 means relevant chapter absent.', groups,differences};
writeFileSync('docs/search-quality/enrichment-pilot/runtime.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));

import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import {searchScoped,resetSearchIndex,whenSearchComplete} from '$lib/search-core';
import {searchableReportSlugs} from '$lib/search-visibility';
import {collections} from '$lib/data/collections';
import type {SearchHit,SearchScope} from '$lib/search-types';
import defaultFixture from './fencing-cases.json';
import {metrics} from '../search-lab/lexical.mjs';

const stage=process.env.FENCING_SEARCH;
const retrievalOnly=stage?.startsWith('ranking-');
const fixture: typeof defaultFixture = process.env.FENCING_FIXTURE
	? JSON.parse(readFileSync(process.env.FENCING_FIXTURE, 'utf8')) : defaultFixture;
it.skipIf(!stage)('evaluates fencing questions in their actual collections, reports, catalog and archive',async()=>{
	const rows:any[]=[];
	const visible=searchableReportSlugs([],'all');
	const main=searchableReportSlugs([],'main');
	const publicCollections=collections.filter(c=>!c.password);
	const files=new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(name=>[name,readFileSync(`static/search/${name}`,'utf8')]));
	const archive:SearchScope={kind:'archive',label:'Весь публичный архив',reportSlugs:visible};
	const catalog:SearchScope={kind:'archive',label:'Главный каталог',reportSlugs:main};
	const key=(h:SearchHit)=>h.chapterIndex!=null?`${h.reportSlug}:chapter:${h.chapterIndex}`:`${h.reportSlug}:${h.kind}:${h.title}`;
	const run=async(query:string, scopes:SearchScope[],relevant:string[],id:string,area:string,collection?:string)=>{
		const started=performance.now();
		const result=await searchScoped(query,scopes,area==='catalog'||area==='archive'?30:120);
		const ms=performance.now()-started;
		const selected=result.resultScope;
		const allowed=new Set(selected.kind==='report'?[selected.reportSlug]:selected.reportSlugs);
		for(const hit of result.hits) expect(allowed.has(hit.reportSlug)).toBe(true);
		const unique=[...new Map(result.hits.map(h=>[key(h),h])).keys()];
		const ranking=unique.map(id=>({id,score:0}));
		rows.push({id,query,area,collection,ms,scopeSize:allowed.size,fallback:result.fallback,matchKind:result.matchKind,
			...metrics(ranking,relevant),negative:!relevant.length,returned:ranking.length,ranking:unique.slice(0,10)});
	};
	vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>new Response(files.get(String(input).split('/').pop()!)??'{}')));
	resetSearchIndex();
	try{
		await searchScoped('захват',[archive]);await whenSearchComplete();
		for(const [i,q]of fixture.cases.entries()){
			expect(visible).toContain(q.reportSlug);
			const report=JSON.parse(readFileSync(`src/lib/data/reports/${q.reportSlug}.json`,'utf8'));
			for(const e of q.evidence){expect(report.chapters[e.chapterIndex].title).toBe(e.title);expect(report.chapters[e.chapterIndex].summary).toBe(e.quote);}
			const memberships=publicCollections.filter(c=>c.items.includes(q.reportSlug));
			expect(memberships.length).toBeGreaterThan(0);
			const reportScope:SearchScope={kind:'report',label:report.title,reportSlug:q.reportSlug};
			const collectionScopes:SearchScope[]=memberships.map(c=>({kind:'collection',label:c.title,reportSlugs:c.items.filter(s=>visible.includes(s))}));
			const relevant=q.chapters.map(i=>`${q.reportSlug}:chapter:${i}`);
			const longest=[...(q.query.match(/[\p{L}]{5,}/gu)??[])].sort((a,b)=>b.length-a.length)[0];
			const pos=Math.floor(longest.length/2);
			const variants=[q.query,q.query.replace(longest,longest.slice(0,pos)+longest.slice(pos+1))];
			for(const [v,query]of variants.entries()){
				const id=q.id+(v?'-typo':'');
				await run(query,[reportScope],relevant,id,'report');
				for(const [j,scope]of collectionScopes.entries()){
					await run(query,[scope],relevant,id,'collection',memberships[j].slug);
					if(!retrievalOnly)await run(query,memberships[j].isolated?[scope]:[scope,archive],relevant,id,'collection-flow',memberships[j].slug);
				}
				if(!retrievalOnly)await run(query,[catalog],relevant,id,'catalog');
				await run(query,[archive],relevant,id,'archive');
				const siblings=memberships[0].items.filter(s=>s!==q.reportSlug&&visible.includes(s));
				const flow:SearchScope[]=[reportScope];
				if(siblings.length)flow.push({kind:'collection',label:memberships[0].title,reportSlugs:siblings});
				if(!memberships[0].isolated)flow.push(archive);
				if(!retrievalOnly)await run(query,flow,relevant,id,'fallback');
			}
			if(i%8===0)console.log(`fencing ${stage}: ${i+1}/${fixture.cases.length}`);
		}
		// Deliberately nonexistent names; count false positives rather than making
		// them pass by pretending the nearest fencing text answers these questions.
		for(const query of ['Техника зюзюбра-91827 с лазерным баклером','Расписание турнира на Марсе 2099','Правила захвата крокозябр-82716','жжщщ ыыъъ']){
			await run(query,[archive],[],query,'archive');
			for(const slug of ['ovchinnikov-lectures','lager-vladivostok','noname','mech-i-bakler-noname']){
				const c=publicCollections.find(c=>c.slug===slug)!;
				await run(query,[{kind:'collection',label:c.title,reportSlugs:c.items.filter(s=>visible.includes(s))}],[],query,'collection',slug);
			}
		}
		mkdirSync('.codex/search-fencing',{recursive:true});
		writeFileSync(`.codex/search-fencing/${stage}.json`,JSON.stringify({protocol:fixture.protocol,
			fixtureHash:createHash('sha256').update(JSON.stringify(fixture)).digest('hex'),
			indexHash:createHash('sha256').update([...files.values()].join('')).digest('hex'),rows},null,2)+'\n');
	}finally{resetSearchIndex();vi.unstubAllGlobals();}
},600000);

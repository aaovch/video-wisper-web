import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { searchScoped, resetSearchIndex, whenSearchComplete } from '$lib/search-core';
import { searchableReportSlugs } from '$lib/search-visibility';
import { collections } from '$lib/data/collections';
import type { SearchScope } from '$lib/search-types';

// Fixed named queries grounded in existing report chapters; not general Q&A gold.
const cases = [
    { query: 'scheitelhau', slug: 'longsword-a', chapter: 4, title: 'Удар по гипотенузе и маскировка' },
    { query: 'scheitel hau', slug: 'longsword-a', chapter: 4, title: 'Удар по гипотенузе и маскировка' },
    { query: 'winden', slug: 'longsword-a', chapter: 14, title: 'Виндены: уступающий и силовой' },
    { query: 'виндунг', slug: 'longsword-a', chapter: 14, title: 'Виндены: уступающий и силовой' },
    { query: 'posta longa', slug: '2026-07-06-19-26-42', chapter: 2, title: 'Базовая ветка угрозы' },
    { query: 'постолонга', slug: '2026-07-06-19-26-42', chapter: 2, title: 'Базовая ветка угрозы' }
];
it('compares named queries on actual shards with strict scopes and source snippets', async () => {
    const visible = searchableReportSlugs([], 'all');
    const files = new Map(['index-core.json','index-transcripts.json','chapter-titles.json'].map(n => [n, readFileSync(`static/search/${n}`, 'utf8')]));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(files.get(String(url).split('/').pop()!))));
    const rows: any[] = [];
    try {
        resetSearchIndex(); await whenSearchComplete();
        for (const q of cases) {
            const report = JSON.parse(readFileSync(`src/lib/data/reports/${q.slug}.json`, 'utf8'));
            expect(report.chapters[q.chapter].title).toBe(q.title);
            expect(visible).toContain(q.slug);
            const collection = collections.find(c => !c.password && c.items.includes(q.slug))!;
            expect(collection).toBeDefined();
            const scopes: SearchScope[] = [
                { kind: 'report', label:q.slug, reportSlug:q.slug },
                { kind: 'collection', label:collection.slug, reportSlugs:collection.items.filter(s=>visible.includes(s)) },
                { kind:'archive', label:'archive', reportSlugs:visible }
            ];
            for (const scope of scopes) {
                const ranks: number[] = [];
                for (const mode of ['0','1']) {
                    vi.stubEnv('VITE_SEARCH_TECHNIQUE_ALIASES', mode);
                    const r = await searchScoped(q.query, [scope], scope.kind === 'archive' ? 30 : 120);
                    const allowed = scope.kind==='report' ? [scope.reportSlug] : scope.reportSlugs;
                    expect(r.hits.every(h=>allowed.includes(h.reportSlug))).toBe(true);
                    const unique = [...new Map(r.hits.map(h=>[h.chapterIndex!=null
                        ? `${h.reportSlug}:chapter:${h.chapterIndex}` : `${h.reportSlug}:${h.kind}:${h.title}`,h])).values()];
                    const rank = unique.findIndex(h=>h.reportSlug===q.slug && h.chapterIndex===q.chapter)+1;
                    ranks.push(rank);
                    rows.push({query:q.query,scope:scope.kind,mode,rank,top:unique.slice(0,5).map(h=>({slug:h.reportSlug,chapter:h.chapterIndex,title:h.title}))});
                }
                if (ranks[0]>0 && ranks[0]<=5) expect(ranks[1],q.query+' '+scope.kind).toBeGreaterThan(0);
                if (ranks[0]>0 && ranks[0]<=5) expect(ranks[1],q.query+' '+scope.kind).toBeLessThanOrEqual(5);
                // Freeze individual successes, not only the aggregate score.
                if (!(scope.kind === 'archive' && ['posta longa','постолонга'].includes(q.query))) {
                    expect(ranks[1],q.query+' '+scope.kind).toBeGreaterThan(0);
                    expect(ranks[1],q.query+' '+scope.kind).toBeLessThanOrEqual(5);
                }
            }
        }
        writeFileSync('docs/search-quality/technique-alias-results.json',JSON.stringify({protocol:'Six fixed named lookups, source-grounded chapter judgments, paired flag off/on. Incomplete relevance judgments.',rows},null,2)+'\n');
        const count=(mode:string)=>rows.filter(r=>r.mode===mode&&r.rank>0&&r.rank<=5).length;
        console.log({before:count('0'),after:count('1'),tasks:rows.length/2});
        expect(count('1')).toBeGreaterThan(count('0'));
    } finally {resetSearchIndex();vi.unstubAllEnvs();vi.unstubAllGlobals();}
},120000);

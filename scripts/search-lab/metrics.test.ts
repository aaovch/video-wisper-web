import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { metrics, rrf } from './lexical.mjs';
import judgments from './pooled-judgments.json';

it('cannot inflate ranking quality by repeating the same relevant passage', () => {
	const repeated = [{ id: 'a', score: 3 }, { id: 'a', score: 2 }, { id: 'b', score: 1 }];
	expect(metrics(repeated, ['a', 'b'])).toMatchObject({ ndcg10: 1, recall10: 1, mrr10: 1 });
});

it('penalizes a relevant passage below the fold and absent answers', () => {
	const result = metrics(['x', 'y', 'z', 'a'].map(id => ({ id, score: 1 })), ['a']);
	expect(result).toMatchObject({ hit1: 0, hit3: 0, hit5: 1, mrr10: 0.25 });
	expect(metrics([{ id: 'x', score: 100 }], ['a'])).toMatchObject({ rank: 0, ndcg10: 0, recall10: 0 });
});

it('fuses ranks without depending on incompatible raw score scales', () => {
	const lists = [[{ id: 'a', score: 100 }, { id: 'b', score: 10 }], [{ id: 'b', score: 0.8 }]];
	expect(rrf(lists)[0].id).toBe('b');
	expect(rrf(lists.map(list => list.map(hit => ({ ...hit, score: hit.score * 1e6 }))))).toEqual(rrf(lists));
});

it('keeps pooled relevance judgments grounded in the actual chapter text', () => {
	for (const judgment of judgments.judgments) {
		const [slug, index] = judgment.documentId.split(':chapter:');
		const report = JSON.parse(readFileSync(`src/lib/data/reports/${slug}.json`, 'utf8'));
		const chapter = report.chapters[Number(index)];
		const body = [chapter.summary, ...(chapter.theses ?? [])].filter(Boolean).join(' ');
		expect(body).toContain(judgment.evidence);
	}
});

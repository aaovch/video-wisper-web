import { describe, expect, it } from 'vitest';
import { reportSearchFragments, fragmentAnchor } from './search-fragments';
import type { SearchHit } from './search-types';

const hit = (chapterIndex: number, reportSlug = 'a'): SearchHit => ({ kind: 'chapter', zone: 'chapters', reportSlug, reportTitle: 'Report', chapterIndex, title: 'Chapter', snippet: 'Text', matchKind: 'exact', href: `/reports/${reportSlug}/#ch-${chapterIndex + 1}`, start: chapterIndex * 60, score: 1 });

describe('reader fragment navigation', () => {
	it('counts unique destinations, excludes other reports and follows source order', () => {
		const input = [hit(4), hit(1), hit(1), hit(0, 'b')];
		expect(reportSearchFragments(input, 'a').map(fragmentAnchor)).toEqual(['ch-2', 'ch-5']);
		expect(input).toHaveLength(4);
	});
	it('merges transcript and chapter hits at the same destination', () => {
		expect(reportSearchFragments([hit(1), { ...hit(1), kind: 'transcript', zone: 'transcript' }], 'a')).toHaveLength(1);
	});
	it('orders chapters by their document position rather than representative passage timestamps', () => {
		expect(reportSearchFragments([{ ...hit(4), start: 0 }, { ...hit(1), start: 999 }], 'a').map(fragmentAnchor)).toEqual(['ch-2', 'ch-5']);
	});
	it('includes overview and additional material once, without counting aggregate reports', () => {
		const overview: SearchHit = { ...hit(0), chapterIndex: undefined, kind: 'overview', zone: 'theses', href: '/reports/a/#overview-title' };
		const material: SearchHit = { ...overview, kind: 'material', zone: 'additional' };
		const aggregate: SearchHit = { ...overview, kind: 'report', zone: 'reports', href: '/reports/a/' };
		expect(reportSearchFragments([hit(0), overview, material, aggregate], 'a').map(fragmentAnchor)).toEqual(['overview-title', 'additional-title', 'ch-1']);
	});
});

import { describe, expect, it } from 'vitest';
import { searchableReportSlugs, visibleSubset } from '$lib/search-visibility';

describe('search visibility', () => {
	it('hides reports that only belong to locked collections', () => {
		expect(searchableReportSlugs([])).not.toContain('retention');
	});

	it('restores locked reports after their collection is unlocked', () => {
		expect(searchableReportSlugs(['hema-theory'])).toContain('retention');
	});

	it('keeps public and unassigned reports searchable', () => {
		const visible = searchableReportSlugs([]);
		expect(visible).toContain('longsword-a');
		expect(visible).toContain('utrenniy-kofe-polugodie-strategiya-segmenty');
	});

	it('keeps an explicitly empty filtered scope empty', () => {
		expect(visibleSubset([], searchableReportSlugs([]))).toEqual([]);
	});
});

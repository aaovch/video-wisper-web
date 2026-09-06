import { describe, expect, it } from 'vitest';
import { searchableReportSlugs, visibleSubset } from '$lib/search-visibility';

describe('search visibility', () => {
	it('hides reports that only belong to locked collections', () => {
		expect(searchableReportSlugs([])).not.toContain('retention');
	});

	it('restores locked reports after their collection is unlocked', () => {
		expect(searchableReportSlugs(['hema-theory'])).toContain('retention');
	});

	it('gates Core NoName meeting reports with their collection', () => {
		expect(searchableReportSlugs([])).not.toContain('sobranie-core-noname-1');
		expect(searchableReportSlugs(['sobraniya-core-noname'])).toContain('sobranie-core-noname-1');
	});

	it('keeps public and unassigned reports searchable', () => {
		const visible = searchableReportSlugs([]);
		expect(visible).toContain('longsword-a');
		expect(visible).toContain('nikitin-muzhchiny-zhenshiny');
	});

	it('keeps an explicitly empty filtered scope empty', () => {
		expect(visibleSubset([], searchableReportSlugs([]))).toEqual([]);
	});
});


describe('archived collections', () => {
 it('excludes archived reports from general search even after unlocking', () => {
  expect(searchableReportSlugs(['hema-english'])).not.toContain('hema-english-snaryazhenie');
 });
 it('searches archived reports separately and preserves local collection search', () => {
  expect(searchableReportSlugs([], 'archive')).toContain('hema-english-snaryazhenie');
  expect(searchableReportSlugs([], 'archive')).not.toContain('longsword-a');
  expect(searchableReportSlugs([], 'all')).toContain('hema-english-snaryazhenie');
  expect(searchableReportSlugs([], 'all')).not.toContain('retention');
 });
});

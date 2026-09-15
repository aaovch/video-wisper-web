import { describe, expect, it } from 'vitest';
import {
	catalogReportSlugs,
	isReportLocked,
	searchableReportSlugs,
	visibleSubset
} from '$lib/search-visibility';
import {
	accessTargetToken,
	canAccessReport,
	canEnterCollection,
	getCollection,
	hasFullCollectionAccess,
	reportGate,
	type Collection
} from '$lib/data/collections';

describe('search visibility', () => {
	it('keeps the tactics collection public while gating its video independently', () => {
		expect(getCollection('shkola-stal')?.access?.master).toBeUndefined();
		expect(reportGate('taktika-4-0-balenko').map((target) => target.id)).toEqual(['report:taktika-4-0-balenko']);
		expect(searchableReportSlugs([], 'all')).not.toContain('taktika-4-0-balenko');
		expect(searchableReportSlugs(['shkola-stal'], 'all')).not.toContain('taktika-4-0-balenko');
		expect(searchableReportSlugs(['report:taktika-4-0-balenko'], 'all')).toContain('taktika-4-0-balenko');
	});

	it('treats a collection password as a master key over package and video keys', () => {
		const fixture: Collection = {
			slug: 'course',
			title: 'Course',
			subtitle: 'Fixture',
			items: ['a', 'b', 'c'],
			access: {
				master: { id: 'course', password: 'master', credentialVersion: 2 },
				passes: [
					{ id: 'course:pack', title: 'Pack', items: ['a', 'b'], password: 'pack' },
					{ id: 'course:video-c', title: 'Video C', items: ['c'], password: 'video' }
				]
			}
		};
		const gateA = reportGate('a', [fixture]);
		const gateC = reportGate('c', [fixture]);
		const masterToken = accessTargetToken(gateA.find((target) => target.kind === 'master')!);
		const packToken = accessTargetToken(gateA.find((target) => target.id === 'course:pack')!);
		const videoToken = accessTargetToken(gateC.find((target) => target.id === 'course:video-c')!);

		expect(gateA.map((target) => target.id)).toEqual(['course', 'course:pack']);
		expect(canAccessReport('a', [masterToken], [fixture])).toBe(true);
		expect(canAccessReport('c', [masterToken], [fixture])).toBe(true);
		expect(canAccessReport('a', [packToken], [fixture])).toBe(true);
		expect(canAccessReport('c', [packToken], [fixture])).toBe(false);
		expect(canAccessReport('c', [videoToken], [fixture])).toBe(true);
		expect(canAccessReport('a', [videoToken], [fixture])).toBe(false);
		expect(canEnterCollection(fixture, [packToken])).toBe(true);
		expect(hasFullCollectionAccess(fixture, [packToken])).toBe(false);
		expect(hasFullCollectionAccess(fixture, [masterToken])).toBe(true);
	});

	it('invalidates a saved unlock when a credential version changes', () => {
		const fixture: Collection = {
			slug: 'versioned',
			title: 'Versioned',
			subtitle: 'Fixture',
			items: ['a'],
			access: { master: { id: 'versioned', password: 'new', credentialVersion: 2 } }
		};
		expect(canAccessReport('a', ['versioned@1'], [fixture])).toBe(false);
		expect(canAccessReport('a', ['versioned@2'], [fixture])).toBe(true);
	});
	it('hides reports that only belong to locked collections', () => {
		expect(searchableReportSlugs([])).not.toContain('retention');
	});

	it('keeps locked reports discoverable in the catalog scope without exposing their content', () => {
		expect(catalogReportSlugs()).toContain('retention');
		expect(isReportLocked('retention', [])).toBe(true);
		expect(isReportLocked('retention', ['hema-theory'])).toBe(false);
	});

	it('keeps individually gated videos discoverable until their own password is entered', () => {
		expect(catalogReportSlugs('all')).toContain('taktika-4-0-balenko');
		expect(isReportLocked('taktika-4-0-balenko', ['shkola-stal'])).toBe(true);
		expect(isReportLocked('taktika-4-0-balenko', ['report:taktika-4-0-balenko'])).toBe(false);
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

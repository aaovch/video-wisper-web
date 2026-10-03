import { describe, expect, it } from 'vitest';
import { analyticsPath, analyticsReferrer, csvCell, parseSnapshot, periodStart, periodVisits } from './analytics';

describe('analytics identity and privacy', () => {
	it('keeps searches and chapter links out of the page identity', () => {
		expect(analyticsPath('/video-wisper-web/reports/test/?q=private#chapter-20')).toBe('/video-wisper-web/reports/test');
		expect(analyticsPath('//video-wisper-web//')).toBe('/video-wisper-web');
	});
	it('keeps only an origin or an explicit safe campaign source', () => {
		expect(analyticsReferrer(new URL('https://example.com/?q=private'), 'https://search.example.com/?token=secret')).toBe('https://search.example.com');
		expect(analyticsReferrer(new URL('https://example.com/?utm_source=telegram'), '')).toBe('campaign:telegram');
		expect(analyticsReferrer(new URL('https://example.com/?utm_source=a%40b.com'), '')).toBe('');
	});
});

describe('periods and missing data', () => {
	it('uses inclusive UTC days across month and leap-year boundaries', () => {
		expect(periodStart('2024-03-01', 3)).toBe('2024-02-28');
		expect(periodStart('2026-10-03', 7)).toBe('2026-09-27');
		expect(periodStart('2026-10-03', 0)).toBe('2026-10-04');
	});
	it('distinguishes a missing export row from a measured zero', () => {
		expect(periodVisits(undefined, '2026-10-01', '2026-10-03')).toBeNull();
		expect(periodVisits({slug:'test',visits:8,daily:[{day:'2026-10-01',visits:3},{day:'2026-10-03',visits:5}]}, '2026-10-02', '2026-10-03')).toBe(5);
	});
	it('rejects duplicate rows and malformed counts rather than displaying them', () => {
		const data = {version:1,timezone:'Asia/Qyzylorda',generatedAt:'2026-10-03T12:00:00Z',startDate:'2026-10-03',endDate:'2026-10-03',rows:[{slug:'test',visits:2,daily:[{day:'2026-10-03',visits:2}]}]};
		expect(parseSnapshot(data).rows[0].visits).toBe(2);
		expect(()=>parseSnapshot({...data,rows:[...data.rows,...data.rows]})).toThrow();
		expect(()=>parseSnapshot({...data,rows:[{...data.rows[0],visits:-1}]})).toThrow();
		expect(()=>parseSnapshot({...data,startDate:'2026-02-30'})).toThrow();
		expect(()=>parseSnapshot({...data,rows:[{...data.rows[0],visits:10}]})).toThrow();
	});
	it('escapes CSV titles including spreadsheet formulas', () => {
		expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
	});
});

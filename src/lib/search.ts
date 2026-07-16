export type { SearchHitKind, SearchZone, SearchHit, ReportGroup, ChapterGroup } from '$lib/search-types';
export {
	searchReports,
	searchReportsExact,
	searchReport,
	searchReportExact,
	preloadSearchIndex
} from '$lib/search-core';
export { groupByReport, groupByChapter } from '$lib/search-group';

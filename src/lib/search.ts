export type {
	SearchHitKind,
	SearchMatchKind,
	SearchResultKind,
	SearchScope,
	SearchResponse,
	SearchZone,
	SearchHit,
	ReportGroup,
	ChapterGroup
} from '$lib/search-types';
export {
	searchReports,
	searchReportsExact,
	searchReport,
	searchReportExact,
	searchScoped,
	resetSearchIndex,
	preloadSearchIndex
} from '$lib/search-core';
export { groupByReport, groupByChapter } from '$lib/search-group';

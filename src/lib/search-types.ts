export type SearchHitKind = 'report' | 'overview' | 'chapter' | 'thesis' | 'transcript' | 'material';
export type SearchZone = 'reports' | 'chapters' | 'theses' | 'transcript' | 'additional';
export type SearchMatchKind = 'exact' | 'prefix' | 'correction' | 'semantic';
export type SearchResultKind = SearchMatchKind | 'empty';

export type SearchScope =
	| { kind: 'report'; label: string; reportSlug: string; zones?: readonly SearchZone[] }
	| { kind: 'collection' | 'archive'; label: string; reportSlugs: readonly string[]; zones?: readonly SearchZone[] };

export interface SearchResponse {
	query: string;
	hits: SearchHit[];
	matchKind: SearchResultKind;
	requestedScope: SearchScope;
	resultScope: SearchScope;
	fallback: boolean;
	correctedQuery?: string;
}

export interface SearchHit {
	kind: SearchHitKind;
	zone: SearchZone;
	reportSlug: string;
	reportTitle: string;
	chapterIndex?: number;
	title: string;
	snippet: string;
	matchKind: SearchMatchKind;
	matchReason?: string[];
	matchReasonKind?: 'tag' | 'semantic' | 'correction';
	href: string;
	start?: number;
	score: number;
}

export interface ReportGroup {
	reportSlug: string;
	reportTitle: string;
	href: string;
	score: number;
	hits: SearchHit[];
}

export interface ChapterGroup {
	chapterIndex: number | null;
	title: string;
	href: string;
	start?: number;
	score: number;
	hits: SearchHit[];
}

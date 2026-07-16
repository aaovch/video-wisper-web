export type SearchHitKind = 'report' | 'overview' | 'chapter' | 'thesis' | 'transcript' | 'material';
export type SearchZone = 'reports' | 'chapters' | 'theses' | 'transcript' | 'additional';

export interface SearchHit {
	kind: SearchHitKind;
	zone: SearchZone;
	reportSlug: string;
	reportTitle: string;
	chapterIndex?: number;
	title: string;
	snippet: string;
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

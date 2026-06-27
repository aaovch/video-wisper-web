export type SearchHitKind = 'report' | 'chapter' | 'transcript';

export interface SearchHit {
	kind: SearchHitKind;
	reportSlug: string;
	reportTitle: string;
	chapterIndex?: number;
	title: string;
	snippet: string;
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

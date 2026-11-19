import type { SearchResponse, SearchScope } from './search-types';

export type SearchReportMetadata = { slug: string; title: string; tags?: string[] };
export type SearchRequest = { base: string; reports?: SearchReportMetadata[] } & (
	| { id: number; method: 'search'; query: string; scopes: readonly SearchScope[]; limit: number; includeAll?: boolean }
	| { id: number; method: 'preload' | 'complete' });

export type SearchReply =
	| { id: number; ok: true; result?: SearchResponse }
	| { id: number; ok: false; error: string };

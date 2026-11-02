import { processSearchTerm } from './search-tokenizer.js';

export const INDEX_VERSION = 6;

/** Identical serialization and query configuration for both index shards. */
export const searchIndexOptions = {
	idField: 'id',
	fields: ['field_title', 'field_body', 'field_tags', 'field_context', 'field_questions'],
	storeFields: ['kind', 'reportSlug', 'chapterIndex', 'start', 'title', 'text', 'reasonTags', 'signalTerms', 'materialKind'],
	processTerm: processSearchTerm
};

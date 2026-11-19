import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import MiniSearch from 'minisearch';
import { expect, it } from 'vitest';
import { packSearchIndex, unpackSearchIndex } from './search-index-codec.js';
import type { AsPlainObject } from 'minisearch';

it('preserves sparse IDs, frequencies, nulls, missing fields and empty indexes', () => {
	const options = { fields: ['title', 'body'], storeFields: ['kind', 'reportSlug', 'title', 'text', 'chapterIndex', 'start'] };
	const mini = new MiniSearch(options);
	mini.addAll([
		{ id: 'a', title: 'Attack', body: 'attack attack', kind: 'chapter', reportSlug: 'one', start: 0, text: null },
		{ id: 'remove', title: 'Discard' },
		{ id: 'b', title: 'Counterattack', body: 'attack counterattack', kind: 'transcript', reportSlug: 'two', chapterIndex: 0, text: '' }
	]);
	mini.discard('remove');
	const source = JSON.parse(JSON.stringify(mini)) as AsPlainObject;
	const restored = unpackSearchIndex(JSON.parse(JSON.stringify(packSearchIndex(source))));
	expect(restored).toEqual(source);
	const loaded = MiniSearch.loadJS(restored as AsPlainObject, options);
	for (const query of ['attack', 'counter', 'attak']) {
		const search = { prefix: true, fuzzy: 0.2 };
		expect(loaded.search(query, search)).toEqual(mini.search(query, search));
	}
	const empty = JSON.parse(JSON.stringify(new MiniSearch(options)));
	expect(unpackSearchIndex(packSearchIndex(empty))).toEqual(empty);
});

it.each(['core', 'transcripts'] as const)('round-trips the entire real %s shard with smaller gzip transfer', kind => {
	const original = readFileSync(`static/search/index-${kind}.json`, 'utf8');
	const manifest = JSON.parse(readFileSync('static/search/manifest.json', 'utf8'));
	const compact = readFileSync(`static/search/${manifest.transport.assets[kind].file}`, 'utf8');
	// All terms, frequencies, field lengths, order, stored text, IDs and stats.
	expect(unpackSearchIndex(JSON.parse(compact))).toEqual(JSON.parse(original));
	expect(gzipSync(compact).byteLength).toBeLessThan(gzipSync(original).byteLength * 0.9);
});

it('rejects an incompatible transport version', () => {
	expect(() => unpackSearchIndex({ format: 'video-wisper-search', version: 999 })).toThrow('Unsupported');
});

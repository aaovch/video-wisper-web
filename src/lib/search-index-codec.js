/** Lossless wire format; MiniSearch's scoring data and document order are unchanged. */
export const SEARCH_WIRE_VERSION = 1;
export const SEARCH_INDEX_MEDIA_TYPE = 'application/vnd.video-wisper.search+json';
const FORMAT = 'video-wisper-search';
const internedFields = new Set(['kind', 'reportSlug', 'materialKind']);

/** @param {Record<string, any>} record */
function packRecord(record) {
	const keys = Object.keys(record);
	return keys.every((key, i) => key === String(i))
		? Object.values(record)
		: { entries: Object.entries(record) };
}

/** @param {any} packed @returns {Record<string, any>} */
function unpackRecord(packed) {
	return Object.fromEntries(Array.isArray(packed) ? packed.map((value, i) => [i, value]) : packed.entries);
}

/** @param {import('minisearch').AsPlainObject} source */
export function packSearchIndex(source) {
	if (source.serializationVersion !== 2) throw new Error('Unsupported MiniSearch serialization');
	const names = [...new Set(Object.values(source.storedFields).flatMap(Object.keys))];
	if (names.length > 30) throw new Error('Too many stored fields');
	/** @type {Record<string, any[]>} */
	const dictionaries = {};
	/** @type {Record<string, Map<any, number>>} */
	const codes = {};
	for (const name of names.filter(name => internedFields.has(name))) {
		dictionaries[name] = [...new Set(Object.values(source.storedFields)
			.filter(doc => Object.hasOwn(doc, name)).map(doc => doc[name]))];
		codes[name] = new Map(dictionaries[name].map((value, i) => [value, i]));
	}
	const rows = Object.fromEntries(Object.entries(source.storedFields).map(([id, doc]) => {
		let mask = 0;
		const values = [];
		for (const [i, name] of names.entries()) {
			if (!Object.hasOwn(doc, name)) continue;
			mask |= 2 ** i;
			values.push(codes[name] ? codes[name].get(doc[name]) : doc[name]);
		}
		return [id, [mask, ...values]];
	}));
	return {
		format: FORMAT,
		version: SEARCH_WIRE_VERSION,
		data: {
			...source,
			documentIds: packRecord(source.documentIds),
			fieldLength: packRecord(source.fieldLength),
			storedFields: { names, dictionaries, rows: packRecord(rows) },
			index: source.index.map(([term, fields]) => [term, ...Object.entries(fields).flatMap(([field, postings]) => {
				let previous = 0;
				return [Number(field), Object.entries(postings).map(([id, frequency]) => {
					const delta = Number(id) - previous;
					previous = Number(id);
					return frequency === 1 ? delta : [delta, frequency];
				})];
			})])
		}
	};
}

/** @param {any} packed @returns {Record<string, any>} */
export function unpackSearchIndex(packed) {
	if (packed?.format !== FORMAT || packed.version !== SEARCH_WIRE_VERSION) {
		throw new Error('Unsupported compact search index');
	}
	const data = packed.data;
	if (data?.serializationVersion !== 2 || !Array.isArray(data.index)) throw new Error('Invalid compact search index');
	const { names, dictionaries, rows } = data.storedFields;
	if (!Array.isArray(names) || names.length > 30) throw new Error('Invalid stored field schema');
	const storedFields = Object.fromEntries(Object.entries(unpackRecord(rows)).map(([id, row]) => {
		const [mask, ...values] = row;
		/** @type {Record<string, any>} */
		const doc = {};
		let position = 0;
		for (const [i, name] of names.entries()) {
			if (!(mask & (2 ** i))) continue;
			if (position >= values.length) throw new Error('Truncated stored fields');
			const value = values[position++];
			if (dictionaries[name]) {
				if (!Object.hasOwn(dictionaries[name], value)) throw new Error('Invalid stored field reference');
				doc[name] = dictionaries[name][value];
			} else doc[name] = value;
		}
		if (position !== values.length) throw new Error('Invalid stored fields');
		return [id, doc];
	}));
	return {
		...data,
		documentIds: unpackRecord(data.documentIds),
		fieldLength: unpackRecord(data.fieldLength),
		storedFields,
		index: data.index.map(/** @param {any[]} row */ (row) => {
			const [term, ...fields] = row;
			if (fields.length % 2) throw new Error('Truncated postings');
			/** @type {Record<string, Record<string, number>>} */
			const result = {};
			for (let i = 0; i < fields.length; i += 2) {
				let id = 0;
				/** @type {Record<string, number>} */
				const postings = {};
				for (const entry of fields[i + 1]) {
					const [delta, frequency] = Array.isArray(entry) ? entry : [entry, 1];
					if (!Number.isSafeInteger(delta) || delta < 0 || !Number.isFinite(frequency)) throw new Error('Invalid posting');
					id += delta;
					postings[id] = frequency;
				}
				result[fields[i]] = postings;
			}
			return [term, result];
		})
	};
}

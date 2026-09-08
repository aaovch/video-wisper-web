import { readFileSync } from 'node:fs';

const dictionary = JSON.parse(readFileSync(new URL('../../src/lib/data/hema-search-dictionary.json', import.meta.url), 'utf8'));
const tokens = text => text.toLowerCase().replace(/ё/g, 'е').match(/[\p{L}\p{N}]+/gu) ?? [];
const normalized = text => ` ${tokens(text).join(' ')} `;

// Whole phrases only. Shared component words and shared expands_to fields
// never identify a named technique. Ambiguous matches remain separate entries.
export function dictionaryHints(text) {
    const haystack = normalized(text);
    return dictionary.entries.flatMap(entry => {
        const matched = [];
        for (const field of ['aliases', 'asr_variants']) {
            for (const phrase of entry[field] ?? []) {
                if (tokens(phrase).join('').length >= 4 && haystack.includes(normalized(phrase))) {
                    matched.push({ text: phrase, type: field === 'aliases' ? 'alias' : 'asr' });
                }
            }
        }
        return matched.length ? [{ ...entry, matched }] : [];
    });
}

export const dictionaryProvenance = {
    source: dictionary.source, sourceVersion: dictionary.sourceVersion, sourceSha256: dictionary.sourceSha256
};

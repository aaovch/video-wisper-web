import presets from './data/hema-search-presets.json';
import rules from './data/search-term-rules.json';

// Reviewed pilot. The authoring dictionary also contains broad aliases such
// as "окно"; importing every preset as a search synonym is unsafe.
const enabled = new Set(rules.groups.filter(g=>g.enabled&&g.scope==='whole-named-query').map(g=>g.id));
const searchable = presets.filter(p => enabled.has(p.id.split('.').pop()!));

export function normalizeTechnique(value: string): string {
    return (value.toLowerCase().replace(/ё/g, 'е').match(/[\p{L}\p{N}]+/gu) ?? []).join(' ');
}

// Entire named query only. Shared properties and individual words of a
// multiword name are never synonym triggers. Ambiguous names have no fallback.
export function techniqueAliases(query: string): string[] {
    const key = normalizeTechnique(query);
    if (key.length < 4) return [];
    const matches = searchable.filter(p => [...p.aliases, ...p.asr].some(a => normalizeTechnique(a) === key));
    if (matches.length !== 1) return [];
    return [...new Set(matches[0].aliases.map(normalizeTechnique))].filter(a => a !== key);
}

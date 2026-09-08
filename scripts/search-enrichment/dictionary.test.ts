import { expect, it } from 'vitest';
import { dictionaryHints, dictionaryProvenance } from './dictionary.mjs';

const presets = (text: string) => dictionaryHints(text).filter(e => e.type === 'preset');
it('recognizes complete names across spaces and hyphens, preserving distinct techniques', () => {
    const hints = presets('Изучаем цорн-хау.');
    expect(hints.some(e => e.id.endsWith('.zornhau'))).toBe(true);
    expect(hints.some(e => e.id.endsWith('.oberhau'))).toBe(false);
    expect(presets('хау')).toEqual([]);
    expect(presets('суперцорнхау')).toEqual([]);
});
it('keeps recognition errors separate from canonical aliases', () => {
    const entry = presets('митсана')[0];
    expect(entry.id).toBe('technique_presets.presets.mezzano');
    expect(entry.matched).toContainEqual({ text: 'митсана', type: 'asr' });
    expect(entry.aliases).not.toContain('митсана');
});
it('does not reconstruct named techniques from shared properties', () => {
    const hints = presets('нисходящий рубящий удар истинным лезвием');
    expect(hints.some(e => e.id.endsWith('.zornhau') || e.id.endsWith('.oberhau'))).toBe(false);
});
it('has a reproducible canonical source fingerprint', () => {
    expect(dictionaryProvenance.source).toBe('hema_fight_analysator/techniques.yaml');
    expect(dictionaryProvenance.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
});

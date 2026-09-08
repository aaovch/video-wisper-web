import { expect, it } from 'vitest';
import { techniqueAliases } from './search-techniques';

it('expands whole named techniques but never shared properties or question words', () => {
    expect(techniqueAliases('ZORNHAU')).toContain('цорнхау');
    expect(techniqueAliases('митсана')).toContain('мецано');
    expect(techniqueAliases('цорн-хау')).toContain('zornhau');
    expect(techniqueAliases('ZORNHAU')).not.toContain('оберхау');
    for (const text of ['хау', 'защита', 'окно', 'posta di finestra', 'Как выполнять zornhau?', 'нисходящий рубящий удар истинным лезвием',
        'После батмана соперник прикрывает руку. Как обойти эту защиту для укола?']) {
        expect(techniqueAliases(text), text).toEqual([]);
    }
});

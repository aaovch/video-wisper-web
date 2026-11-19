import { describe, expect, it } from 'vitest';
import { formatDuration, formatTime, getVideoSourceUrl, russianPlural } from './utils';

it('formats fractional chapter starts consistently without rounding into the next second', () => {
	expect(formatTime(602.1)).toBe('10:02');
	expect(formatTime(2.61)).toBe('0:02');
	expect(formatTime(3599.99)).toBe('59:59');
});

it('uses Russian count forms across teens and hundreds', () => {
	const forms = ['совпадение', 'совпадения', 'совпадений'] as const;
	for (const n of [1, 21, 101]) expect(russianPlural(n, forms)).toBe('совпадение');
	for (const n of [2, 4, 23, 104]) expect(russianPlural(n, forms)).toBe('совпадения');
	for (const n of [0, 5, 11, 12, 14, 111]) expect(russianPlural(n, forms)).toBe('совпадений');
});

describe('formatDuration', () => {
	it('uses the requested language without changing the Russian default', () => {
		expect(formatDuration(4500)).toBe('1 ч 15 мин');
		expect(formatDuration(4500, 'en')).toBe('1 hr 15 min');
	});
});

describe('getVideoSourceUrl', () => {
	it('prefers the report source URL', () => {
		expect(getVideoSourceUrl(
			{ provider: 'youtube', id: 'juJgNjw8FD8' },
			'https://youtu.be/juJgNjw8FD8'
		)).toBe('https://youtu.be/juJgNjw8FD8');
	});

	it('builds provider links for reports without source_url', () => {
		expect(getVideoSourceUrl({ provider: 'youtube', id: 'abc123' }))
			.toBe('https://www.youtube.com/watch?v=abc123');
		expect(getVideoSourceUrl({ provider: 'vk', id: '-84793390_456240032' }))
			.toBe('https://vkvideo.ru/video-84793390_456240032');
		expect(getVideoSourceUrl({ provider: 'vimeo', id: '7654321' }))
			.toBe('https://vimeo.com/7654321');
	});

	it('keeps private Rutube access and local base paths', () => {
		expect(getVideoSourceUrl({
			provider: 'rutube',
			id: 'ff6c4d49343b052bfb34a016b10e7104',
			privateToken: 'private token'
		})).toBe('https://rutube.ru/video/ff6c4d49343b052bfb34a016b10e7104/?p=private%20token');
		expect(getVideoSourceUrl({ provider: 'file', src: 'media/video.mp4' }, undefined, '/video-wisper'))
			.toBe('/video-wisper/media/video.mp4');
	});
});

import { describe, expect, it } from 'vitest';
import { getVideoSourceUrl } from './utils';

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

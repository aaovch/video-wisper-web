import type { VideoSource } from '$lib/types';

/** URL постера/превью для карточки (без сетевых запросов). */
export function getVideoPosterUrl(video: VideoSource | undefined, base = ''): string | null {
	if (!video) return null;
	switch (video.provider) {
		case 'youtube':
			return `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
		case 'rutube': {
			const id = video.id;
			return id.length >= 4
				? `https://pic.rutubelist.ru/video/${id.slice(0, 2)}/${id.slice(2, 4)}/${id}.jpg?width=640`
				: null;
		}
		case 'file':
			return video.poster ? `${base}/${video.poster}` : null;
		default:
			return null;
	}
}

/** Форматирует секунды в `M:SS` или `H:MM:SS`. */
export function formatTime(totalSeconds: number): string {
	const s = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(s / 3600);
	const minutes = Math.floor((s % 3600) / 60);
	const seconds = s % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	if (hours > 0) {
		return `${hours}:${pad(minutes)}:${pad(seconds)}`;
	}
	return `${minutes}:${pad(seconds)}`;
}

/** Человекочитаемая длительность, напр. «7 мин» или «1 ч 15 мин». */
export function formatDuration(totalSeconds: number): string {
	const s = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(s / 3600);
	const minutes = Math.round((s % 3600) / 60);
	if (hours > 0) {
		return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
	}
	return `${Math.max(1, minutes)} мин`;
}

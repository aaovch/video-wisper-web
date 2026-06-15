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

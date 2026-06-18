import type { Collection } from '$lib/data/collections';

/**
 * Состояние «разблокированных» коллекций. Лёгкий замок: помним подобранные
 * пароли в localStorage, чтобы не спрашивать их повторно.
 */
const STORAGE_KEY = 'vw-unlocked';

function load(): string[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? (parsed as string[]) : [];
	} catch {
		return [];
	}
}

class LockState {
	unlocked = $state<string[]>(load());

	isUnlocked(slug: string): boolean {
		return this.unlocked.includes(slug);
	}

	/**
	 * Пытается разблокировать любую из коллекций подходящим паролем.
	 * Возвращает true при успехе.
	 */
	tryUnlock(targets: Collection[], password: string): boolean {
		const match = targets.find((c) => c.password && c.password === password);
		if (!match) return false;
		if (!this.unlocked.includes(match.slug)) {
			this.unlocked = [...this.unlocked, match.slug];
			this.persist();
		}
		return true;
	}

	private persist() {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.unlocked));
		} catch {
			// localStorage недоступен (приватный режим и т.п.) — просто не сохраняем.
		}
	}
}

export const lock = new LockState();

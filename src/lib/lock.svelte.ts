import {
	accessTargetToken,
	allAccessTargets,
	isAccessTargetUnlocked,
	type AccessTarget
} from '$lib/data/collections';

/**
 * Состояние «разблокированных» коллекций. Лёгкий замок: помним подобранные
 * пароли в localStorage, чтобы не спрашивать их повторно.
 */
const STORAGE_KEY = 'vw-unlocked-v2';
const LEGACY_STORAGE_KEY = 'vw-unlocked';

function load(): string[] {
	if (import.meta.env.VITE_HEMA_SERVER) return (globalThis as typeof globalThis & { __hema?: { unlocked: string[] } }).__hema?.unlocked ?? [];
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(parsed)) return [];
		const targets = allAccessTargets();
		const byId = new Map(targets.map((target) => [target.id, target]));
		const validTokens = new Set(targets.map(accessTargetToken));
		return [...new Set(
			(parsed as unknown[])
				.filter((value): value is string => typeof value === 'string')
				.map((value) => {
					if (validTokens.has(value)) return value;
					const legacyTarget = byId.get(value);
					return legacyTarget && (legacyTarget.credentialVersion ?? 1) === 1
						? accessTargetToken(legacyTarget)
						: undefined;
				})
				.filter((value): value is string => Boolean(value))
		)];
	} catch {
		return [];
	}
}

class LockState {
	unlocked = $state<string[]>(load());

	isUnlocked(target: AccessTarget): boolean {
		return isAccessTargetUnlocked(target, this.unlocked);
	}

	/**
	 * Разблокирует все переданные ключи с подходящим паролем. Это важно для
	 * осознанно переиспользуемого пароля нескольких пакетов.
	 * Возвращает true при успехе.
	 */
	async tryUnlock(targets: AccessTarget[], password: string, destination?: string | ((target: AccessTarget | undefined) => string | undefined)): Promise<boolean> {
		if (import.meta.env.VITE_HEMA_SERVER) {
			const body = new URLSearchParams({ key: password });
			for (const target of targets) body.append('target', target.id);
			const response = await fetch('/api/login', { method: 'POST', body }).catch(() => null);
			if (!response?.ok) return false;
			if (response.headers.get('X-Archive-Admin') === '/admin/') {
				location.assign('/admin/');
				return true;
			}
			const matched = targets.find(target => encodeURIComponent(target.id) === response.headers.get('X-Archive-Target'));
			const url = typeof destination === 'function' ? destination(matched) : destination;
			location.assign(url ?? location.href);
			return true;
		}
		const matches = targets.filter((target) => target.password !== 'server-managed-credential' && target.password === password);
		if (matches.length === 0) return false;
		const next = new Set(this.unlocked);
		for (const match of matches) next.add(accessTargetToken(match));
		if (next.size !== this.unlocked.length) {
			this.unlocked = [...next];
			this.persist();
		}
		return true;
	}

	private persist() {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.unlocked));
			localStorage.removeItem(LEGACY_STORAGE_KEY);
		} catch {
			// localStorage недоступен (приватный режим и т.п.) — просто не сохраняем.
		}
	}
}

export const lock = new LockState();

import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

function readInitial(): Theme {
	if (!browser) return 'light';
	const attr = document.documentElement.dataset.theme;
	if (attr === 'light' || attr === 'dark') return attr;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Тема оформления: применяется к <html data-theme> и запоминается в localStorage. */
class ThemeState {
	current = $state<Theme>(readInitial());

	constructor() {
		this.#syncMeta();
	}

	set(next: Theme) {
		this.current = next;
		this.#apply();
	}

	toggle() {
		this.set(this.current === 'dark' ? 'light' : 'dark');
	}

	#apply() {
		if (!browser) return;
		document.documentElement.dataset.theme = this.current;
		try {
			localStorage.setItem('theme', this.current);
		} catch {
			// приватный режим/квота — не критично
		}
		this.#syncMeta();
	}

	#syncMeta() {
		if (!browser) return;
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', this.current === 'dark' ? '#17140f' : '#f3efe6');
	}
}

export const theme = new ThemeState();

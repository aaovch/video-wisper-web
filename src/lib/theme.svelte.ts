import { browser } from '$app/environment';

import { applyTheme, syncThemeColor, type Theme } from './theme-preference';
export type { Theme } from './theme-preference';

/** Тема оформления: применяется к <html data-theme> и запоминается в localStorage. */
class ThemeState {
	current = $state<Theme>(browser && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

	constructor() {
		if (browser) syncThemeColor(this.current);
	}

	set(next: Theme) {
		this.current = next;
		if (browser) applyTheme(next);
	}
}

export const theme = new ThemeState();

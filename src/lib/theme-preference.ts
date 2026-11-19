export type Theme = 'light' | 'dark';

export function syncThemeColor(theme: Theme) {
	document.querySelector('meta[name="theme-color"]')
		?.setAttribute('content', theme === 'dark' ? '#17140f' : '#f3efe6');
}

export function applyTheme(theme: Theme) {
	document.documentElement.dataset.theme = theme;
	syncThemeColor(theme);
	try {
		localStorage.setItem('theme', theme);
	} catch {
		// Storage may be unavailable even when the page can change theme.
	}
}

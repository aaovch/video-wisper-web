import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// При сборке на GitHub Pages для project-репозитория сайт живёт по адресу
// https://<user>.github.io/<repo>/ , поэтому нужен base = "/<repo>".
// Workflow выставляет BASE_PATH автоматически. Локально base пустой.
const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			// GitHub Pages гзипует ответы на лету и игнорирует заранее сжатые
			// .gz/.br-соседи, поэтому precompress только раздул бы артефакт.
			// Крупный static/search/index.json (~16 МБ) отдаётся уже сжатым хостом.
			precompress: false,
			strict: true
		}),
		paths: {
			base
		},
		prerender: {
			handleHttpError: 'warn'
		}
	}
};

export default config;

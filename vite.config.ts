import { serverUi } from './server/ui-build.mjs';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [...(process.env.HEMA_SERVER_UI ? [serverUi()] : []), sveltekit()],
	// Workers have a separate Vite pipeline. Session-scoped catalog data must
	// stay injected at runtime here too, rather than embedding the static JSON.
	worker: { plugins: () => process.env.HEMA_SERVER_UI ? [serverUi()] : [] },
	test: {
		include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
		// Real-index suites each parse large shards; avoid memory/CPU contention.
		maxWorkers: 2
	}
});

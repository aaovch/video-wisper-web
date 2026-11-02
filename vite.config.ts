import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
		// Real-index suites each parse large shards; avoid memory/CPU contention.
		maxWorkers: 2
	}
});

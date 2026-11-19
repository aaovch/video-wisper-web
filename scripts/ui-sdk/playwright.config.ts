import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: '.',
	testMatch: '*.spec.ts',
	outputDir: '../../.codex/ui-sdk-tests',
	workers: 1,
	use: { baseURL: 'http://127.0.0.1:4197', channel: 'chrome', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
	webServer: [
		{ command: 'node scripts/ui-sdk/serve.mjs', cwd: '../..', url: 'http://127.0.0.1:4197', reuseExistingServer: false },
		{ command: 'node node_modules/vite/bin/vite.js --config scripts/ui-sdk/harness.config.ts', cwd: '../..', url: 'http://127.0.0.1:4198', reuseExistingServer: false },
	],
});

import { spawnSync } from 'node:child_process';

function run(command, args, env = process.env) {
	const result = spawnSync(command, args, { stdio: 'inherit', env, shell: false });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}

const output = process.env.SEARCH_LAB_DIR ?? '.codex/search-lab';
run(process.execPath, ['scripts/build-search-index.mjs']);
run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'scripts/search-lab/search-lab.test.ts'],
	{ ...process.env, SEARCH_LAB: '1', SEARCH_LAB_DIR: output });
if (process.argv.includes('--neural')) {
	run(process.env.SEARCH_LAB_PYTHON ?? 'python', ['-X', 'utf8', 'scripts/search-lab/neural.py', '--dir', output, '--rerank']);
}
run(process.execPath, ['scripts/search-lab/summarize.mjs', output, ...(process.argv.includes('--neural') ? [] : ['--lexical-only'])]);

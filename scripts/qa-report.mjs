import { spawnSync } from 'node:child_process';

const target = process.argv[2] ?? '--all';
const npm = 'npm';

function run(command, args) {
	const result = spawnSync(command, args, {
		stdio: 'inherit',
		env: process.env,
		shell: process.platform === 'win32' && command === npm
	});
	if (result.error) {
		console.error(result.error.message);
		process.exit(1);
	}
	if (result.status !== 0) process.exit(result.status ?? 1);
}

run(npm, ['run', 'build-search-index']);
run(process.execPath, ['scripts/validate-site.mjs', target]);
run(process.execPath, ['scripts/verify-search-index.mjs', target]);
run(npm, ['run', 'check']);
run(npm, ['test']);
run(npm, ['run', 'build:site']);

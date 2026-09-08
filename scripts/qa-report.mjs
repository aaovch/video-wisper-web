import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const target = args.find(arg => !arg.startsWith('--')) ?? '--all';
if (args.some(arg => arg.startsWith('--') && !['--all', '--require-search-cards'].includes(arg))) {
 console.error('Unknown QA option'); process.exit(1);
}
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

// Surface every stale/invalid sidecar before the global index build. Missing
// optional cards remain explicit and do not require model availability.
run(process.execPath, ['scripts/search-enrichment/audit.mjs', '--all', '--summary']);
if (args.includes('--require-search-cards')) run(process.execPath, ['scripts/search-enrichment/audit.mjs', target, '--require-complete']);
run(npm, ['run', 'build-search-index']);
run(process.execPath, ['scripts/validate-site.mjs', target]);
run(process.execPath, ['scripts/verify-search-index.mjs', target]);
run(npm, ['run', 'check']);
run(npm, ['test']);
run(npm, ['run', 'build:site']);

import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('counts a long summary separately from overview theses', () => {
	const output = execFileSync(
		process.execPath,
		['scripts/verify-search-index.mjs', 'nri-staraya-shahta'],
		{ encoding: 'utf8' }
	);

	expect(output).toContain('search-index OK: nri-staraya-shahta');
	expect(output).toContain('235 theses');
});

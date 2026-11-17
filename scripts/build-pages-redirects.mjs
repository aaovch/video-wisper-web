import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const origin = 'https://hema-archive.com';
const prefix = '/video-wisper-web';
const output = '.codex/pages-redirects';
const catalog = async (name) => JSON.parse(await readFile(`src/lib/data/${name}.json`, 'utf8'));

function redirectPage(path) {
	const target = origin + path;
	return `<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Архив переехал</title>
<script>
const prefix = ${JSON.stringify(prefix)};
const path = location.pathname === prefix ? '/' : location.pathname.startsWith(prefix + '/') ? location.pathname.slice(prefix.length) : '/';
location.replace(${JSON.stringify(origin)} + path + location.search + location.hash);
</script>
<noscript><meta http-equiv="refresh" content="0;url=${target}"></noscript>
<p>Архив переехал на <a href="${target}">hema-archive.com</a>.</p>
</html>
`;
}

const routes = ['/', '/archive/', '/stats/'];
for (const [section, entries] of [['reports', await catalog('report-meta')], ['collections', await catalog('collections')]]) {
	for (const { slug } of entries) {
		if (!/^[a-z0-9_-]+$/i.test(slug)) throw new Error(`Invalid route slug: ${slug}`);
		routes.push(`/${section}/${slug}/`);
	}
}
for (const path of routes) {
	const dir = join(output, path.slice(1));
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, 'index.html'), redirectPage(path));
}
// Pages serves this file at the requested URL for older, unlisted paths.
await writeFile(join(output, '404.html'), redirectPage('/'));
await writeFile(join(output, '.nojekyll'), '');

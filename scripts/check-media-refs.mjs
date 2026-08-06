/** Сверяет ссылки "media/..." в отчётах с файлами в static/. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = join(root, 'src/lib/data/reports');
const missing = [];

for (const file of readdirSync(reportsDir).filter((name) => name.endsWith('.json'))) {
	const text = readFileSync(join(reportsDir, file), 'utf8');
	for (const match of text.matchAll(/"(media\/[^"]+)"/g)) {
		if (!existsSync(join(root, 'static', match[1]))) missing.push(`${file} -> ${match[1]}`);
	}
}

if (missing.length) {
	console.error(missing.join('\n'));
	process.exit(1);
}
console.log('all media refs OK');

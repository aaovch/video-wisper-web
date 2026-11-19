import { basename } from 'node:path';
import { readFileSync } from 'node:fs';

// In the server edition these datasets are supplied with the current session.
const runtime = new Map([
  ['collections.json', ['collections', '[]']],
  ['report-meta.json', ['reports', '[]']],
  ['search-source-links.json', ['graph', '{links:[]}']]
]);
/** @returns {import('vite').Plugin} */
export function serverUi() {
  return {
    name: 'hema-server-ui',
    enforce: 'pre',
    resolveId(source) {
      const item = runtime.get(basename(source));
      if (item) return '\0hema-catalog:' + basename(source) + '.js';
    },
    load(id) {
      if (id.startsWith('\0hema-catalog:')) {
        const pair = runtime.get(id.slice(14,-3));
        if (!pair) throw Error('Unknown catalog module');
        const [key, fallback] = pair;
        return 'export default globalThis.__hema?.' + key + ' ?? ' + fallback;
      }
      if (id.replaceAll('\\', '/').endsWith('/src/lib/data/index.ts')) {
        return readFileSync(new URL('./ui-data.ts', import.meta.url), 'utf8');
      }
    }
  };
}

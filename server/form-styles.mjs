import { readFileSync } from 'node:fs';

const tokens = readFileSync(new URL('../src/lib/styles/tokens.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('./submissions/style.css', import.meta.url), 'utf8');

export const formStyles = tokens + '\n' + layout;

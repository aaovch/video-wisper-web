import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hiddenTopicReportSlugs } from '../src/lib/catalog-visibility.js';
import { normalizeCollections, resolveReportGate } from '../src/lib/data/report-access.js';
import { openAccessStore } from './access-store.mjs';
import { OWNER_SCOPE } from './access-policy.mjs';

const data = fileURLToPath(new URL('../src/lib/data/', import.meta.url));
const read = file => JSON.parse(readFileSync(join(data, file), 'utf8'));
const collections = normalizeCollections(read('collections.json'));
const slugs = new Set(collections.flatMap(collection => collection.items));
const gates = new Map([...slugs].map(slug => [slug, resolveReportGate(slug, collections).map(target => target.id)]));
const scopes = new Set(collections.flatMap(c => [c.access?.master, ...(c.access?.passes ?? [])]).filter(Boolean).map(c => c.id));
scopes.add(OWNER_SCOPE);
const hidden = hiddenTopicReportSlugs(collections);
const archived = new Set(collections.filter(c => c.archived).flatMap(c => c.items));
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const formsPath = '/_app/server-forms.js';
const formsBundle = new URL('../.codex/server-ui/_app/server-forms.js', import.meta.url);
const page = (title, body) => `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · HEMA-архив</title><script defer src="${formsPath}"></script><main><header><a href="/">HEMA-архив</a></header><h1>${escape(title)}</h1>${body}</main></html>`;
const login = '<form method="post" action="/login"><label>Ключ доступа <ui-input data-agent-secret><input name="key" type="password" autocomplete="current-password" required></ui-input></label> <ui-button><button type="submit">Открыть доступ</button></ui-button></form>';

export function archiveServer(store, origin) {
  const url = new URL(origin);
  const secure = url.protocol === 'https:';
  if (!secure && url.origin !== 'http://127.0.0.1:' + url.port) throw Error('Use HTTPS or loopback HTTP');
  const cookieName = secure ? '__Host-hema_session' : 'hema_local_session';
  const cookie = (value, age) => `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const chapters = new Map();
  for (const slug of slugs) {
    if (hidden.has(slug)) continue;
    const {title, chapters: rows} = read('reports/' + slug + '.json');
    chapters.set(slug, {title, rows});
  }
  return createServer(async (req, res) => {
    const send = (code, body, type = 'text/html; charset=utf-8') => {
      res.writeHead(code, {'Content-Type':type, 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'same-origin', 'Content-Security-Policy': `default-src 'none'; script-src ${url.origin}${formsPath}; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`});
      res.end(body);
    };
    try {
      if (req.headers.host !== url.host) return send(400, '');
      const {pathname, searchParams} = new URL(req.url, url);
      if (pathname === formsPath) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, '');
        return send(200, req.method === 'HEAD' ? '' : readFileSync(formsBundle), 'text/javascript; charset=utf-8');
      }
      const session = req.headers.cookie?.split(/; */).find(c => c.startsWith(cookieName + '='))?.slice(cookieName.length + 1) ?? '';
      const scope = store.scope(session);
      const allowed = slug => gates.has(slug) && (scope === OWNER_SCOPE || !gates.get(slug).length || gates.get(slug).includes(scope));
      if (req.method === 'POST' && ['/login','/logout'].includes(pathname)) {
        if (req.headers.origin !== url.origin) return send(403, '');
        if (pathname === '/login') {
          let body = '';
          for await (const chunk of req) {
            if (Buffer.byteLength(body) + chunk.length > 1024) return send(413, '');
            body += chunk;
          }
          const next = store.login(new URLSearchParams(body).get('key') ?? '');
          if (!next) return send(403, page('Ключ не подошёл', login));
          store.logout(session);
          res.setHeader('Set-Cookie', cookie(next, 86400));
        } else {
          store.logout(session);
          res.setHeader('Set-Cookie', cookie('', 0));
        }
        res.setHeader('Location','/');
        return send(303,'');
      }
      if (req.method !== 'GET') return send(405,'');
      if (pathname === '/') {
        const query = (searchParams.get('q') ?? '').trim().toLocaleLowerCase('ru').slice(0,200);
        const archive = searchParams.get('area') === 'archive';
        const hits = [];
        for (const [slug, report] of chapters) {
          if (!allowed(slug) || archived.has(slug) !== archive) continue;
          const href = '/reports/' + encodeURIComponent(slug) + '/';
          if (!query) hits.push(`<li><a href="${href}">${escape(report.title)}</a></li>`);
          else for (const [i, ch] of report.rows.entries()) {
            if ([report.title,ch.title,ch.summary,...ch.theses ?? []].join(' ').toLocaleLowerCase('ru').includes(query)) {
              hits.push(`<li><a href="${href}#chapter-${i}">${escape(report.title)} · ${escape(ch.title)}</a></li>`);
            }
          }
        }
        return send(200,page('Поиск по архиву',`<nav><a href="/">Каталог</a> · <a href="/?area=archive">Архив</a></nav><form><input type="hidden" name="area" value="${archive ? 'archive' : 'main'}"><label>Поиск <ui-input><input name="q" type="search" value="${escape(query)}"></ui-input></label> <ui-button><button type="submit">Найти</button></ui-button></form><ul>${hits.join('')}</ul>${scope ? '<form method="post" action="/logout"><ui-button><button type="submit">Выйти</button></ui-button></form>' : login}`));
      }
      const route = /^\/(reports|transcripts)\/([a-z0-9-]+)\/?$/.exec(pathname);
      if (!route || !slugs.has(route[2])) return send(404,'');
      const [,kind,slug] = route;
      if (!allowed(slug)) return send(403,page('Материал по ключу',login));
      const report = read('reports/' + slug + '.json');
      if (kind === 'transcripts') return report.has_transcript
        ? send(200,JSON.stringify(read('transcripts/' + slug + '.json')),'application/json; charset=utf-8') : send(404,'');
      const blocks = report.chapters.map((ch,i) => {
        const watch = report.video?.provider === 'youtube' ? `<a href="https://www.youtube.com/watch?v=${encodeURIComponent(report.video.id)}&amp;t=${Math.floor(ch.start)}s">Смотреть с ${Math.floor(ch.start / 60)}:${String(Math.floor(ch.start % 60)).padStart(2,'0')}</a>` : '';
        return `<section id="chapter-${i}"><h2>${escape(ch.title)}</h2><p>${escape(ch.summary ?? '')}</p>${watch}</section>`;
      });
      return send(200,page(report.title,blocks.join('') + (report.has_transcript ? `<p><a href="/transcripts/${slug}">Расшифровка</a></p>` : '')));
    } catch {
      if (!res.headersSent) send(500,'Ошибка сервера');
      else res.destroy();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const store = openAccessStore(process.env.HEMA_ACCESS_DB ?? join(homedir(), '.hema-archive', 'access.sqlite'));
  const [command = 'serve', scope] = process.argv.slice(2);
  if (command === 'serve') {
    if (!existsSync(formsBundle)) await import('./build-forms.mjs');
    const port = Number(process.env.PORT ?? 4185);
    const origin = process.env.HEMA_ORIGIN ?? 'http://127.0.0.1:' + port;
    archiveServer(store, origin).listen(port, '127.0.0.1', () => console.log(origin));
  } else if (command === 'scopes') console.log([...scopes].join('\n'));
  else if (command === 'issue' && scopes.has(scope)) console.log(store.issue(scope));
  else if (command === 'revoke' && scopes.has(scope)) store.revoke(scope);
  else throw Error('Use serve, scopes, issue <scope> or revoke <scope>');
}

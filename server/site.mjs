import { servePrivateReader, privateRecord } from './submissions/private-reader.mjs';
import { addIntakeLinks } from './intake-footer.mjs';
import { deviceChallenges } from './device-auth.mjs';
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openAccessStore } from './access-store.mjs';
import { pageMetadata, sitemap } from './metadata.mjs';
import { SEARCH_INDEX_MEDIA_TYPE } from '../src/lib/search-index-codec.js';
import { OWNER_SCOPE } from './access-policy.mjs';
import { handlePasswordAdmin } from './password-admin.mjs';
import { normalizeCollections, isPrivateReport } from '../src/lib/data/report-access.js';
import { publicPreviewDocument, publicReportPreview } from '../src/lib/data/report-preview.js';
import { openSubmissions } from './submissions/store.mjs';
import { submissionHandler } from './submissions/http.mjs';
import { workerHandler } from './submissions/remote.mjs';
import { startDispatcher } from './submissions/dispatch.mjs';
import { archiveSnapshot, publicationDocs } from './submissions/publication.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const file = (...parts) => join(root, ...parts);
const json = (...parts) => JSON.parse(readFileSync(file(...parts), 'utf8'));
const dataset = name => json('src/lib/data',name + '.json');
const collections = normalizeCollections(dataset('collections'));
const reports = dataset('report-meta');
const graph = dataset('search-source-links');
const media = new Map();
for (const {slug} of reports) {
  if (!collections.some(c => c.items.includes(slug))) throw Error('Missing access policy for ' + slug);
  const report = dataset('reports/' + slug);
  for (const [,asset] of JSON.stringify(report).matchAll(/"(media\/[\w.-]+)"/g)) {
    if (!media.has(asset)) media.set(asset, new Set());
    media.get(asset).add(slug);
  }
}
const credentials = collections.flatMap(c => [c.access?.master, ...(c.access?.passes ?? [])]).filter(Boolean);
const mime = {'.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.ico':'image/x-icon', '.html':'text/html', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.png':'image/png', '.mp4':'video/mp4'};
function streamFile(req, res, path, type, compressed = false) {
  const size = statSync(path).size;
  res.setHeader('Content-Type', type);
  if (compressed) res.setHeader('Content-Encoding','gzip');
  let start = 0, end = size - 1;
  const range = req.headers.range;
  if (range && type === 'video/mp4') {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(end, Number(match[2])) : end;
    }
    if (!match || (!match[1] && !match[2]) || start > end || start >= size) {
      res.writeHead(416, {'Content-Range':'bytes */' + size}); return res.end();
    }
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
  }
  if (type === 'video/mp4') res.setHeader('Accept-Ranges','bytes');
  res.setHeader('Content-Length', end - start + 1);
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(path,{start,end});
  res.on('close',() => stream.destroy());
  stream.on('error',() => res.destroy()).pipe(res);
}

export function siteServer(store, origin, submissions = {}) {
  store.rememberPasswords(credentials.map(c => c.password).filter(key => key !== 'server-managed-credential'));
  let cachedSnapshot;
  let cachedRevision;
  function currentCatalog() {
    const revision = submissions.store?.publicationRevision?.();
    if (!cachedSnapshot || (submissions.store && revision === undefined) || revision !== cachedRevision) {
      cachedSnapshot = archiveSnapshot(submissions.store, collections, reports);
      cachedSnapshot.trackedSlugs = new Set(cachedSnapshot.collections.filter(c => c.hema && !c.catalogHidden).flatMap(c => c.items)
        .filter(slug => !isPrivateReport(slug, cachedSnapshot.collections)));
      cachedRevision = revision;
    }
    return cachedSnapshot;
  }
  const handleWorker = workerHandler(submissions.store, submissions.workerSecret);
  const handleSubmission = submissionHandler(submissions.store, {
    ...submissions,nativeReader:true,setCollectionKey:store.setCollectionKey,sealPassword:store.sealPassword,
    archiveCollections: () => currentCatalog().collections,
    archiveReports: () => currentCatalog().reports
  });
  const url = new URL(origin);
  const secure = url.protocol === 'https:';
  if (!secure && url.hostname !== '127.0.0.1') throw Error('HTTPS required');
  const name = secure ? '__Host-hema_session' : 'hema_local_session';
  const shell = readFileSync(file('.codex/server-ui/shell.html'),'utf8');
  const lifetime = 400 * 86400;
  const challenges = deviceChallenges();
  const cookieId = scope => name + '_' + createHash('sha256').update(scope).digest('hex').slice(0,24);
const sessionCookie = (id, value) => `${id}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${value ? lifetime : 0}${secure ? '; Secure' : ''}`;
  return createServer(async (req,res) => {
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options','SAMEORIGIN');
    const reply = (status,body = '',type = 'text/plain; charset=utf-8') => {
      res.writeHead(status,{'Content-Type':type}); res.end(req.method === 'HEAD' ? undefined : body);
    };
    const pageNotFound = () => (req.headers.accept ?? '').includes('text/html')
      ? reply(404, '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Страница не найдена · HEMA-архив</title><main><h1>Страница не найдена</h1><a href="/">На главную</a></main></html>', 'text/html; charset=utf-8')
      : reply(404);
    try {
      if (req.headers.host !== url.host) return reply(400);
      const {pathname} = new URL(req.url, url);
      if (['/initial-theme.js','/favicon.svg','/favicon.ico','/favicon-32x32.png','/apple-touch-icon.png','/icon-192.png','/icon-512.png','/site.webmanifest','/social-preview-v1.png'].includes(pathname)) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return reply(405);
        const path = file('static', pathname);
        if (!existsSync(path)) return reply(404);
        res.setHeader('Cache-Control','public, max-age=3600');
        return streamFile(req,res,path,mime[extname(path)]);
      }
      if (/^\/_app\/[a-zA-Z0-9_.\/-]+$/.test(pathname) && !pathname.includes('..')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return reply(405);
        const path = file('.codex/server-ui',pathname);
        if (!existsSync(path) || !statSync(path).isFile()) return reply(404);
        if (pathname.startsWith('/_app/immutable/')) res.setHeader('Cache-Control','public, max-age=31536000, immutable');
        return streamFile(req,res,path,mime[extname(path)] ?? 'application/octet-stream');
      }
      if (await handleWorker({ req, res, pathname })) return;
      const sessions = new Map();
      for (const cookie of (req.headers.cookie ?? '').split(/; */)) {
        const [id, value] = cookie.split('=');
        if (id === name || (id.startsWith(name + '_') && /^[0-9a-f]{24}$/.test(id.slice(name.length + 1)))) sessions.set(id, value);
      }
      const scopes = new Set([...sessions.values()].flatMap(token => store.scopes(token)));
      const owner = scopes.has(OWNER_SCOPE);
      if (await handlePasswordAdmin({req,res,pathname,origin:url.origin,owner,store,collections:()=>currentCatalog().collections,manageVideos:!!submissions.store})) return;
      if (servePrivateReader({req,pathname,reply,origin:url,owner,store:submissions.store,shell})) return;
      if (await handleSubmission({ req, res, pathname, origin:url.origin, owner })) return;
      const {collections,reports,safeCollections,gates,records,trackedSlugs} = currentCatalog();
      const indexScopes = owner ? new Set([OWNER_SCOPE]) : new Set([...scopes].filter(s=>!s.startsWith('submission-collection-')));
      const allowed = slug => gates.has(slug) && (owner || !gates.get(slug).length || gates.get(slug).some(scope => scopes.has(scope)));
      const exclusionCookie = secure ? '__Host-hema_stats_excluded' : 'hema_stats_excluded';
      const excluded = (req.headers.cookie ?? '').split(/; */).includes(exclusionCookie + '=1');
      if (pathname === '/api/statistics/preference') {
        if (req.method === 'GET') return reply(200, JSON.stringify({excluded}), mime['.json']);
        if (req.method !== 'POST') return reply(405);
        if (req.headers.origin !== url.origin) return reply(403);
        const value = new URL(req.url, url).searchParams.get('excluded');
        if (value !== '1' && value !== '0') return reply(400);
        res.setHeader('Set-Cookie', `${exclusionCookie}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${value === '1' ? 34560000 : 0}${secure ? '; Secure' : ''}`);
        return reply(200, JSON.stringify({excluded: value === '1'}), mime['.json']);
      }
      if (pathname === '/api/statistics' && req.method === 'GET') {
        return reply(200, JSON.stringify(store.analytics.snapshot([...trackedSlugs])), mime['.json']);
      }
      if (pathname === '/api/visits' && req.method === 'POST') {
        if (req.headers.origin !== url.origin) return reply(403);
        if (excluded) return reply(204);
        if (/bot|crawl|spider|headless|scanner|lighthouse|pagespeed|pingdom|uptimerobot|curl\/|wget\/|python-requests\//i.test(req.headers['user-agent'] ?? '')) return reply(204);
        let body = '';
        for await (const chunk of req) {
          if (Buffer.byteLength(body) + chunk.length > 256) return reply(413);
          body += chunk;
        }
        let slug;
        try { slug = JSON.parse(body).slug; } catch { return reply(400); }
        if (typeof slug !== 'string' || !trackedSlugs.has(slug)) return reply(400);
        if (!allowed(slug)) return reply(403);
        const cookieName = secure ? '__Host-hema_visit' : 'hema_visit';
        let visitor = (req.headers.cookie ?? '').split(/; */).find(c => c.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
        if (!visitor || !/^[a-f0-9]{48}$/.test(visitor)) visitor = randomBytes(24).toString('hex');
        store.analytics.record(slug, visitor);
        res.setHeader('Set-Cookie', cookieName + '=' + visitor + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=1800' + (secure ? '; Secure' : ''));
        return reply(204);
      }
      if (pathname === '/device-client.js' && req.method === 'GET')
        return streamFile(req,res,file('server/device-client.js'),'text/javascript');
      if (req.method === 'POST' && ['/api/device/challenge','/api/device/remember'].includes(pathname)) {
        if (req.headers.origin !== url.origin) return reply(403);
        if (pathname.endsWith('/challenge')) {
          const challenge = challenges.issue();
          return challenge ? reply(200,challenge) : reply(429);
        }
        let body = '';
        for await (const chunk of req) {
          if (Buffer.byteLength(body) + chunk.length > 2048) return reply(413);
          body += chunk;
        }
        let proof;
        try { proof = JSON.parse(body); } catch { return reply(400); }
        if (!proof || !challenges.verify(proof)) return reply(403);
        const recovered = store.syncDevice(proof.publicKey,sessions.values(),lifetime * 1000);
        const cookies = [...sessions].filter(([,raw]) => store.scope(raw)).map(([id,raw]) => sessionCookie(id,raw));
        for (const [scope,raw] of recovered) cookies.push(sessionCookie(cookieId(scope),raw));
        if (cookies.length) res.setHeader('Set-Cookie',cookies);
        return reply(200,JSON.stringify({restored: recovered.length > 0}),'application/json');
      }
      if (req.method === 'POST' && ['/api/login','/api/logout','/admin/logout'].includes(pathname)) {
        if (req.headers.origin !== url.origin) return reply(403);

        if (pathname === '/api/login') {
          let body = '';
          for await (const chunk of req) {
            if (Buffer.byteLength(body) + chunk.length > 4096) return reply(413);
            body += chunk;
          }
          const params = new URLSearchParams(body);
          const next = store.login(params.get('key') ?? '', params.getAll('target'), lifetime * 1000);
          if (!next) return reply(403);
          const scope = store.scope(next);
          if (scope === OWNER_SCOPE) res.setHeader('X-Archive-Admin','/admin/');
          const id = cookieId(scope);
          if (sessions.has(id)) store.logout(sessions.get(id));
          const available = store.scopes(next);
          const target = params.getAll('target').find(id => available.includes(id)) ?? scope;
          res.setHeader('X-Archive-Target', encodeURIComponent(target));
          res.setHeader('Set-Cookie', sessionCookie(id, next));
        } else {
          for (const token of sessions.values()) { store.forget(token); store.logout(token); }
          res.setHeader('Set-Cookie', [...sessions.keys()].map(id => sessionCookie(id, '')));
        }
        if (pathname === '/admin/logout') { res.setHeader('Location','/'); return reply(303); }
        return reply(204);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return reply(405);
      const isPublic = slug => gates.has(slug) && gates.get(slug).length === 0;
      if (pathname === '/robots.txt') return reply(200, `User-agent: *\nDisallow: /api/\nDisallow: /admin/\nDisallow: /search/\nDisallow: /transcripts/\nDisallow: /stats/\nSitemap: ${url.origin}/sitemap.xml\n`);
      if (pathname === '/sitemap.xml') return reply(200, sitemap(url.origin, safeCollections, reports, isPublic), 'application/xml; charset=utf-8');
      const shard = /^\/search\/(index-core|index-transcripts|chapter-titles)\.json$/.exec(pathname);
      const extraDocs = /^\/search\/extra-(core|transcripts)\.json$/.exec(pathname);
      let previewSearch;
      if ((shard || extraDocs) && req.headers.referer) {
        const ref=URL.canParse(req.headers.referer) && new URL(req.headers.referer);
        const match=ref.origin===url.origin && /^\/reports\/preview-([a-f0-9]{32})\/?$/.exec(ref.pathname);
        if(match) previewSearch=privateRecord(submissions.store,req,url,owner,match[1]);
      }
      if (extraDocs) {
        const recordings = previewSearch?[JSON.stringify(publicationDocs(previewSearch,extraDocs[1]==='transcripts'))]:[];
        for (const [slug, required] of gates) {
          const path = file('.codex/private-index/recordings', slug + '.' + extraDocs[1] + '.json.gz');
          if (indexScopes.size<=1 || !required.length || !allowed(slug) || !existsSync(path)) continue;
          recordings.push(gunzipSync(readFileSync(path)).toString('utf8'));
        }
        for(const [slug,p] of records) {
          if(allowed(slug))recordings.push(JSON.stringify(publicationDocs(p,extraDocs[1]==='transcripts')));
          else if(extraDocs[1]==='core' && !isPrivateReport(slug,collections))recordings.push(JSON.stringify([publicPreviewDocument(publicReportPreview(p.report,collections))]));
        }
        return reply(200,'[' + recordings.join(',') + ']',mime['.json']);
      }
      if (shard) {
        if ((indexScopes.size > 1 || records.size || previewSearch) && shard[1] === 'chapter-titles') {
          const titles = previewSearch?{[previewSearch.report.slug]:previewSearch.report.chapters.map(c=>c.title)}:{};
          for (const scope of indexScopes.size?indexScopes:[null]) {
            const folder = scope?Buffer.from(scope).toString('base64url'):'public';
            Object.assign(titles, JSON.parse(gunzipSync(readFileSync(file('.codex/private-index',folder,'chapter-titles.json.gz')))));
          }
          for(const [slug,p] of records)if(allowed(slug))titles[slug]=p.report.chapters.map(c=>c.title);
          return reply(200,JSON.stringify(titles),mime['.json']);
        }
        if (indexScopes.size > 1 || records.size || previewSearch) res.setHeader('X-Archive-Search-Extras','1');
        const scope = indexScopes.size === 1 && [...indexScopes][0];
        const group = scope ? Buffer.from(scope).toString('base64url') : 'public';
        const compactPath = file('.codex/private-index',group,shard[1] + '.compact.json.gz');
        res.setHeader('Vary','Accept');
        if (shard[1] !== 'chapter-titles' && req.headers.accept?.includes(SEARCH_INDEX_MEDIA_TYPE) && existsSync(compactPath)) {
          return streamFile(req,res,compactPath,SEARCH_INDEX_MEDIA_TYPE,true);
        }
        return streamFile(req,res,file('.codex/private-index',group,shard[1] + '.json.gz'),mime['.json'],true);
      }
      const transcript = /^\/transcripts\/([\w-]+)(\.chapters)?\.json$/.exec(pathname);
      if (transcript) {
        if (!allowed(transcript[1])) return reply(403);
        const published=records.get(transcript[1]);
        if(published)return reply(200,JSON.stringify(transcript[2]?{chapters:published.transcript.chapters}:{transcript:published.transcript.transcript}),mime['.json']);
        const path = file('static',pathname);
        return existsSync(path) ? streamFile(req,res,path,mime['.json']) : reply(404);
      }
      if (pathname.startsWith('/media/')) {
        const owners = media.get(pathname.slice(1));
        if (!owners || ![...owners].some(allowed)) return reply(403);
        return streamFile(req,res,file('static',pathname),mime[extname(pathname)]);
      }
      const api = /^\/api\/reports\/([\w-]+)$/.exec(pathname);
      if (api) {
        const slug = api[1];
        if (!gates.has(slug)) return reply(404);
        if(allowed(slug)&&records.has(slug))return reply(200,JSON.stringify(records.get(slug).report),mime['.json']);
        if (allowed(slug)) return streamFile(req,res,file('src/lib/data/reports',slug + '.json'),mime['.json']);
        const report = records.get(slug)?.report ?? dataset('reports/' + slug);
        return reply(200,JSON.stringify({...publicReportPreview(report,collections),chapters:[],tags:[]}),mime['.json']);
      }
      const extra = {'/analytics/summary.json':'static/analytics/summary.json','/pilot/':'pilot/dist/index.html','/pilot/example.json':'pilot/dist/example.json','/example.json':'pilot/dist/example.json'};
      if (Object.hasOwn(extra,pathname)) {
        if (pathname.includes('pilot') || pathname.includes('example.json')) {
          if (!allowed('ukol-po-centralnoy-linii')) return reply(403);
        }
        const path = file(extra[pathname]);
        return existsSync(path) ? streamFile(req,res,path,mime[extname(path)]) : reply(404);
      }
      if (!['/','/stats/','/archive/'].includes(pathname) && !/^\/(reports|collections)\/[\w-]+\/?$/.test(pathname)) return pageNotFound();
      const previewCollections = safeCollections.map(c => c.private ? {...c,description:undefined,subtitle:'Внутренние записи. Доступ по ключу.',sections:undefined,analysis:undefined,itemFacets:undefined} : c);
      const publicReports = reports.map(r => publicReportPreview(r,collections));
      const metadata = pageMetadata(pathname, url.origin, previewCollections, publicReports, isPublic);
      if (!metadata) return pageNotFound();
      const statistics = pathname === '/stats/';
      const reading = pathname.startsWith('/reports/');
      const catalog = statistics ? {
        collections: safeCollections.filter(c => c.hema && !c.catalogHidden && !c.isolated && !c.private)
          .map(({slug,title,items,hema}) => ({slug,title,items,hema})),
        reports: reports.filter(r => trackedSlugs.has(r.slug)).map(({slug,title}) => ({slug,title})),
        graph: {links: []},
        unlocked: []
      } : {
        collections:safeCollections.map((c,i) => c.private && !owner && !scopes.has(c.access.master?.id) ? previewCollections[i] :
          c.access?.master && !owner && !scopes.has(c.access.master.id) ? {...c,analysis:undefined} : c),
        reports:reports.map(r => {
          const accessible = allowed(r.slug);
          if (reading) return {slug:r.slug, title:accessible ? r.title : publicReportPreview(r,collections).title, tags:accessible ? r.tags : undefined};
          if (accessible) return r;
          return publicReportPreview(r,collections);
        }),
        graph:{links:graph.links.filter(link => link.sources.every(s => allowed(s.reportSlug)))},
        unlocked:safeCollections.flatMap(c=>[c.access?.master,...(c.access?.passes??[])]).filter(Boolean).filter(t => owner || scopes.has(t.id)).map(t => t.id + '@' + (t.credentialVersion ?? 1))
      };
      const bootstrap = '<script>globalThis.__hema=' + JSON.stringify({...catalog,owner}).replaceAll('<','\\u003c') + '</script><script defer src="/device-client.js"></script>';
      let html = shell.replace('<head>', () => '<head>' + metadata + bootstrap);
      // Links leaving a reduced bootstrap must load the destination's full catalog.
      if (statistics || reading) html = html.replace('<body', '<body data-page-catalog');
      if (submissions.enabled) html = addIntakeLinks(html, pathname === '/');
      return reply(200,html,'text/html; charset=utf-8');
    } catch (error) {
      console.error('Request failed:',error.code ?? error.name);
      if (res.headersSent) res.destroy(); else reply(500);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const store = openAccessStore(process.env.HEMA_ACCESS_DB);
  const submissions = process.env.HEMA_SUBMISSIONS_DB ? openSubmissions(process.env.HEMA_SUBMISSIONS_DB) : null;
  if (submissions && process.env.HEMA_CLOUD_JOB && (process.env.HEMA_SUBMISSIONS_ENABLED === '1' || process.env.HEMA_SUBMISSIONS_PILOT === '1')) startDispatcher(submissions, { jobName:process.env.HEMA_CLOUD_JOB, credentialsFile:process.env.HEMA_GOOGLE_CREDENTIALS });
  siteServer(store,process.env.HEMA_ORIGIN, { store:submissions, workerSecret:process.env.HEMA_WORKER_SECRET, pilot:process.env.HEMA_SUBMISSIONS_PILOT === '1', enabled:process.env.HEMA_SUBMISSIONS_ENABLED === '1', maxMinutes:Number(process.env.HEMA_MAX_VIDEO_MINUTES ?? 120) }).listen(Number(process.env.PORT ?? 4186),process.env.HEMA_LISTEN ?? '127.0.0.1');
}

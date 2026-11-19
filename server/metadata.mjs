import { archiveSite, canonicalUrl, socialImage, socialImageAlt } from '../src/lib/site-metadata.js';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));

/** Only public summaries may be used here, even when the visitor is signed in. */
export function pageMetadata(pathname, origin, collections, reports, isPublic) {
  let title = `${archiveSite.name} — ${archiveSite.tagline}`;
  let description = archiveSite.description;
  let type = 'website', language = 'ru', noindex = pathname === '/stats/';
  const match = /^\/(reports|collections)\/([\w-]+)\/?$/.exec(pathname);
  if (match) {
    const record = (match[1] === 'reports' ? reports : collections).find(r => r.slug === match[2]);
    if (!record) return null;
    title = `${record.title} — ${archiveSite.name}`;
    language = record.language ?? 'ru';
    if (match[1] === 'reports') {
      type = 'article';
      language = collections.some(c => c.language === 'en' && c.items?.includes(record.slug)) ? 'en' : 'ru';
      noindex = !isPublic(record.slug);
      if (!noindex && record.subtitle) description = record.subtitle;
    } else {
      description = record.description || record.subtitle || description;
      noindex = Boolean(record.private);
    }
  } else if (pathname === '/stats/') title = `Статистика — ${archiveSite.name}`;
  else if (pathname === '/archive/') {
    title = `Архив — ${archiveSite.name}`;
    description = 'Архивные коллекции с отдельным поиском по материалам.';
  }
  const canonical = canonicalUrl(pathname, origin);
  const image = new URL(socialImage, origin).href;
  const tag = (attribute, key, value) => `<meta data-server-meta ${attribute}="${key}" content="${escapeHtml(value)}" />`;
  return [
    `<title data-server-meta>${escapeHtml(title)}</title>`,
    `<link data-server-meta rel="canonical" href="${escapeHtml(canonical)}" />`,
    tag('name', 'description', description),
    ...Object.entries({type, site_name: archiveSite.name, title, description, url: canonical,
      locale: language === 'en' ? 'en_US' : 'ru_RU', image, 'image:type': 'image/png',
      'image:width': '1200', 'image:height': '630', 'image:alt': socialImageAlt})
      .map(([key,value]) => tag('property', 'og:' + key, value)),
    ...Object.entries({card: 'summary_large_image', title, description, image, 'image:alt': socialImageAlt})
      .map(([key,value]) => tag('name', 'twitter:' + key, value)),
    ...(noindex ? [tag('name', 'robots', 'noindex')] : [])
  ].join('\n');
}

export function sitemap(origin, collections, reports, isPublic) {
  const paths = ['/', '/archive/', ...collections.filter(c => !c.private).map(c => `/collections/${c.slug}/`),
    ...reports.filter(r => isPublic(r.slug)).map(r => `/reports/${r.slug}/`)];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    paths.map(path => `<url><loc>${escapeHtml(canonicalUrl(path, origin))}</loc></url>`).join('') + '</urlset>';
}

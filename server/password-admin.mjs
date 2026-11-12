import { readFileSync } from 'node:fs';
import { passwordShareTargets, passwordAccessMessage } from './password-share.mjs';

const styles = readFileSync(new URL('./submissions/style.css', import.meta.url), 'utf8');
const copyScript = readFileSync(new URL('./password-share-client.js', import.meta.url), 'utf8');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function page(content,manageVideos) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Админка — HEMA архив</title><link rel="icon" href="/favicon.svg"><style>${styles}
    main{max-width:960px}.admin-nav{display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px;margin:0 0 32px;font:16px/1.5 var(--font-ui)}.admin-nav form{margin:0 0 0 auto}.passwords{list-style:none;padding:0}.passwords>li{padding:24px 0;border-top:1px solid var(--line)}.passwords h3{font-size:22px}.passwords code{display:block;overflow-wrap:anywhere;white-space:pre-wrap;padding:12px 16px;background:var(--paper-3);font:16px/1.5 var(--font-mono)}.password-form{display:flex;align-items:end;gap:12px;margin:20px 0 0}.password-form label{flex:1;margin:0}.password-form input{margin-top:6px}.password-form button{flex-shrink:0}.notice{padding:16px;border-left:3px solid var(--success);background:var(--surface)}[role=alert]{color:var(--danger)}@media(max-width:600px){.password-form{align-items:stretch;flex-direction:column}.admin-nav form{margin:0}}
    .password-access{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:start;margin:12px 0}.password-access code{margin:0}.access-message,.copy-status{grid-column:1/-1}.access-message{width:100%;min-height:120px;padding:12px;background:var(--paper);color:var(--ink);border:1px solid var(--edge);font:16px/1.5 var(--font-ui)}.copy-status{margin:0}@media(max-width:600px){.password-access{grid-template-columns:minmax(0,1fr)}.copy-access{width:100%}}
    </style><script>(()=>{let theme;try{theme=localStorage.getItem('theme')}catch{}document.documentElement.dataset.theme=theme==='light'||theme==='dark'?theme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()</script></head><body><div class="sheet"><main id="main-content"><nav class="admin-nav" aria-label="Навигация"><a href="/">← В архив</a>${manageVideos ? '<a href="/submit/">Управление видео</a>' : ''}<form method="post" action="/admin/logout"><button class="secondary">Выйти</button></form></nav><h1>Админка</h1>${content}</main></div><script type="module">${copyScript}</script></body></html>`;
}

function passwordEntry(target,password) {
  if (password === null) return '<p class="hint">Текст старого пароля не сохранён. Задайте новый пароль ниже.</p>';
  return `<div class="password-access" data-password-access><code>${escape(password)}</code><button class="secondary copy-access" data-copy-access type="button" hidden>Скопировать доступ</button><textarea class="access-message" data-access-message readonly hidden aria-label="Текст доступа для пересылки">${escape(passwordAccessMessage(target,password))}</textarea><p class="hint copy-status" data-copy-status role="status" aria-live="polite"></p></div>`;
}

export async function handlePasswordAdmin({req,res,pathname,origin,owner,store,collections,manageVideos=false}) {
  if (!['/admin','/admin/','/admin/passwords'].includes(pathname)) return false;
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  const send = (status,content) => {
    res.writeHead(status,{'Content-Type':'text/html; charset=utf-8'});
    res.end(req.method === 'HEAD' ? undefined : page(content,manageVideos && owner));
    return true;
  };
  if (!owner) return send(403,'<p>Админка доступна по мастер-ключу владельца. Введите его через кнопку «Ввести ключ» на <a href="/">главной странице</a>.</p>');
  const catalog = passwordShareTargets(collections(),origin);
  let error = '';
  if (pathname === '/admin/passwords') {
    if (req.method !== 'POST') return send(405,'<p>Используйте форму изменения пароля.</p>');
    if (req.headers.origin !== origin) return send(403,'<p>Запрос отклонён. Откройте админку на сайте архива.</p>');
    let body = '';
    for await (const chunk of req) {
      if (Buffer.byteLength(body) + chunk.length > 4096) return send(413,'<p>Слишком большой запрос.</p>');
      body += chunk;
    }
    const data = new URLSearchParams(body);
    const scope = data.get('scope');
    if (!catalog.has(scope)) return send(400,'<p>Группа доступа не найдена.</p>');
    try { store.setPassword(scope,data.get('password')); }
    catch (cause) {
      // Only validation errors are suitable for display, never database errors.
      if (!['Этот пароль уже используется. Выберите другой.','Задайте пароль длиной от 8 до 128 символов без пробелов по краям.'].includes(cause.message)) throw cause;
      error = cause.message;
    }
    if (!error) {
      res.writeHead(303,{Location:'/admin/?saved=' + encodeURIComponent(scope)});
      res.end();
      return true;
    }
  } else if (!['GET','HEAD'].includes(req.method)) return send(405,'<p>Метод не поддерживается.</p>');
  const saved = new URL(req.url,origin).searchParams.get('saved');
  const passwords = store.passwords();
  const entries = [...catalog].map(([scope,target],i) => {
    const keys = passwords.filter(key => key.scope === scope);
    return `<li><h3>${escape(target.title)}</h3><p class="hint">${escape(target.label)}</p>
      ${keys.length ? keys.map(key => passwordEntry(target,key.password)).join('') : '<p class="hint">Пароль ещё не задан.</p>'}
      <form class="password-form" method="post" action="/admin/passwords"><input type="hidden" name="scope" value="${escape(scope)}"><label for="password-${i}">Новый пароль<input id="password-${i}" name="password" type="text" required minlength="8" maxlength="128" autocomplete="off" autocapitalize="none" spellcheck="false"></label><button>Сохранить пароль</button></form></li>`;
  }).join('');
  return send(error ? 400 : 200, `<h2>Пароли доступа</h2><p>Здесь видны пароли коллекций и отдельных записей. Смена пароля заменяет все прежние пароли выбранной группы и закрывает доступ по ним.</p><p class="hint">Старые пароли, текст которых не сохранён, появятся после следующего входа с ними. Их также можно заменить здесь.</p>${error ? `<p role="alert">${escape(error)}</p>` : catalog.has(saved) ? `<p class="notice" role="status">Пароль для «${escape(catalog.get(saved).title)}» сохранён.</p>` : ''}<ul class="passwords">${entries}</ul>`);
}

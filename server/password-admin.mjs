import { readFileSync } from 'node:fs';
import { passwordShareTargets, passwordAccessMessage } from './password-share.mjs';
import { PASSWORD_ERROR } from './password-policy.mjs';

const styles = readFileSync(new URL('./submissions/style.css', import.meta.url), 'utf8');
const copyScript = readFileSync(new URL('./password-share-client.js', import.meta.url), 'utf8');
const adminStyles = readFileSync(new URL('./password-admin.css', import.meta.url), 'utf8');
const adminScript = readFileSync(new URL('./password-admin-client.js', import.meta.url), 'utf8');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function page(content,manageVideos) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Админка — HEMA архив</title><link rel="icon" href="/favicon.svg"><style>${styles}
    ${adminStyles}
    </style><script>(()=>{let theme;try{theme=localStorage.getItem('theme')}catch{}document.documentElement.dataset.theme=theme==='light'||theme==='dark'?theme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()</script></head><body><a class="skip" href="#main-content">К содержимому</a><div class="sheet"><main id="main-content"><nav class="admin-nav" aria-label="Навигация"><a href="/">← В архив</a>${manageVideos ? '<a href="/submit/">Управление видео</a>' : ''}<form method="post" action="/admin/logout"><button class="secondary">Выйти</button></form></nav><header class="admin-heading"><h1>Админка</h1><p>Найдите материал и скопируйте готовый текст со ссылкой и паролем для пересылки.</p></header>${content}</main></div><script type="module">${copyScript}\n${adminScript}</script></body></html>`;
}

function passwordEntry(target,password,index) {
  if (password === null) return '<p class="hint">Текст старого пароля не сохранён. Задайте новый пароль ниже.</p>';
  return `<div class="password-access" data-password-access><div class="password-value"><span>Пароль</span><code>${escape(password)}</code></div><button class="copy-access" data-copy-access type="button" aria-describedby="title-${index}" hidden>Скопировать доступ</button><textarea class="access-message" data-access-message readonly hidden aria-label="Текст доступа для пересылки: ${escape(target.title)}">${escape(passwordAccessMessage(target,password))}</textarea><p class="hint copy-status" data-copy-status role="status" aria-live="polite"></p></div>`;
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
  let errorScope = '';
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
      if (!['Этот пароль уже используется. Выберите другой.',PASSWORD_ERROR].includes(cause.message)) throw cause;
      error = cause.message;
      errorScope = scope;
    }
    if (!error) {
      res.writeHead(303,{Location:'/admin/?saved=' + encodeURIComponent(scope) + '#access-' + encodeURIComponent(scope)});
      res.end();
      return true;
    }
  } else if (!['GET','HEAD'].includes(req.method)) return send(405,'<p>Метод не поддерживается.</p>');
  const saved = new URL(req.url,origin).searchParams.get('saved');
  const passwords = store.passwords();
  const entries = [...catalog].map(([scope,target],i) => {
    const keys = passwords.filter(key => key.scope === scope);
    const failed=errorScope===scope;
    const kind=target.kind==='collection'?'Коллекция':target.kind==='recording'?'Запись':'Набор записей';
    const linkLabel=target.kind==='collection'?'Открыть коллекцию':target.kind==='recording'?'Открыть запись':'Открыть набор';
    return `<li class="access-card" id="access-${escape(scope)}" data-access-row data-kind="${target.kind}" data-search="${escape(target.title+' '+target.collectionTitle)}">
      <header><p class="access-kind">${kind}</p><h3 id="title-${i}">${escape(target.title)}</h3>${target.kind!=='collection'?`<p class="collection-name">${escape(target.collectionTitle)}</p>`:''}<a class="material-link" href="${escape(target.url)}">${linkLabel}</a></header>
      ${keys.length ? keys.map(key => passwordEntry(target,key.password,i)).join('') : '<p class="access-unavailable">Пароль ещё не задан.</p>'}
      ${saved===scope?'<p class="row-notice" role="status">Пароль сохранён. Прежний пароль больше не действует.</p>':''}
      <details class="password-editor"${failed?' open':''}><summary aria-describedby="title-${i}">${keys.length?'Изменить пароль':'Задать пароль'}</summary>
      <form class="password-form" method="post" action="/admin/passwords"><input type="hidden" name="scope" value="${escape(scope)}"><p class="change-hint" id="change-hint-${i}">Один пароль, от 4 до 8 символов. После сохранения прежний пароль перестанет действовать.</p><label for="password-${i}">Новый пароль<input id="password-${i}" name="password" type="text" required minlength="4" maxlength="8" placeholder="4–8 символов" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="change-hint-${i}${failed?' password-error-'+i:''}"${failed?' aria-invalid="true" autofocus':''}></label>${failed?`<p id="password-error-${i}" role="alert">${escape(error)}</p>`:''}<div class="password-actions"><button>Сохранить пароль</button><button class="secondary" data-cancel-password type="button" hidden>Отмена</button></div></form></details></li>`;
  }).join('');
  return send(error ? 400 : 200, `<section aria-labelledby="passwords-heading"><h2 class="admin-section-title" id="passwords-heading">Пароли доступа</h2><div class="admin-tools" data-admin-tools hidden><div class="admin-filter-fields"><label>Найти доступ<input type="search" data-access-search placeholder="Название записи или коллекции" autocomplete="off" aria-controls="password-list"></label><label>Тип доступа<select data-access-filter aria-controls="password-list"><option value="all">Все доступы</option><option value="collection">Коллекции</option><option value="recording">Записи и наборы</option></select></label></div><div class="admin-results"><span data-access-count role="status" aria-live="polite" aria-atomic="true"></span><button class="admin-reset" type="button" data-reset-access hidden>Сбросить</button></div></div><noscript><p class="no-js-note">Для быстрого поиска и копирования включите JavaScript. Пароли и формы доступны ниже.</p></noscript><ul class="passwords" id="password-list">${entries}</ul><div class="admin-empty" data-access-empty hidden><h3>Ничего не найдено</h3><p>Попробуйте другое название или сбросьте фильтры.</p><button class="secondary" type="button" data-reset-access>Сбросить поиск</button></div></section>`);
}

import {hasReadableResult,passedReview} from './result-ready.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TRANSCRIPTION_SUNSET } from './transcription.mjs';
import { youtubeUrl } from './store.mjs';
import {costText} from './private-reader.mjs';
import {placementInput,makePublication} from './publication.mjs';
import {validAccessPassword,PASSWORD_ERROR} from '../password-policy.mjs';

const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const activeStates = ['queued','launching','downloading','transcribing','summarizing'];
function ownerControls(row) {
  const action = activeStates.includes(row.state) ? 'stop' : ['failed','stopped'].includes(row.state) ? 'retry' : null;
  if (!action) return '';
  return `<form method="post" action="/submit/${row.id}/${action}"><input type="hidden" name="attempt" value="${row.attempt}"><button class="secondary">${action === 'stop' ? 'Остановить обработку' : 'Перезапустить обработку'}</button></form>`;
}
const states = { stopped:'Остановлено владельцем', local_ready:'Локальная обработка завершена', queued:'В очереди', launching:'Запускаем обработку', downloading:'Получаем аудио', transcribing:'Распознаём речь', summarizing:'Готовим и проверяем разбор', review:'Разбор готов', published:'Опубликовано', failed:'Не удалось обработать видео', rejected:'Не опубликовано', consent_required:'Нужно согласие на облачную обработку' };
const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
const time = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
const listScript = `document.addEventListener('DOMContentLoaded',()=>{const list=document.querySelector('[data-owner-list]');if(!list)return;let busy=false;setInterval(async()=>{if(busy||document.hidden||list.contains(document.activeElement))return;busy=true;try{const r=await fetch('/submit/',{cache:'no-store'});if(!r.ok)return;const page=new DOMParser().parseFromString(await r.text(),'text/html');const updated=page.querySelector('[data-owner-list]');if(updated&&!list.contains(document.activeElement)&&list.innerHTML!==updated.innerHTML)list.innerHTML=updated.innerHTML}catch{}finally{busy=false}},15000)});`;
function bindIntakeForm(validateUrl) {
  const form = document.querySelector('form[data-submit-once]');
  if (!form) return;
  const { url, consent } = form.elements;
  const button = form.querySelector('button[type="submit"]');
  const hint = document.getElementById('url-error');

  function sync() {
    let error = '';
    try { validateUrl(url.value); } catch (cause) { error = cause.message; }
    hint.textContent = url.value ? error : '';
    hint.hidden = !hint.textContent;
    if (!button.hasAttribute('aria-busy')) button.textContent = 'Разобрать видео';
    button.disabled = Boolean(error) || !consent.checked || button.hasAttribute('aria-busy');
  }

  form.addEventListener('input', sync);
  form.addEventListener('change', sync);
  form.addEventListener('submit', event => {
    sync();
    if (button.disabled) {
      event.preventDefault();
      return;
    }
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.textContent = 'Отправляем…';
  });
  window.addEventListener('pageshow', () => {
    button.removeAttribute('aria-busy');
    sync();
  });
  sync();
}
const intakeScript = `document.addEventListener('DOMContentLoaded', () => (${bindIntakeForm})(${youtubeUrl}));`.replace(/\r\n?/g, '\n');
const themeScript = intakeScript + listScript + "(()=>{let t;try{t=localStorage.getItem('theme')}catch{}document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.addEventListener('DOMContentLoaded',()=>{const b=document.getElementById('theme-toggle');b.hidden=false;const sync=()=>{b.setAttribute('aria-label',document.documentElement.dataset.theme==='dark'?'Включить светлую тему':'Включить тёмную тему')};sync();b.addEventListener('click',()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;try{localStorage.setItem('theme',t)}catch{}sync()})})})();document.addEventListener('DOMContentLoaded',()=>{\n const copy=document.getElementById('copy-link'),link=document.getElementById('submission-link'),status=document.getElementById('copy-status');\n if(copy&&link){copy.hidden=false;copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link.value);status.textContent='Ссылка скопирована. Отправьте её Александру.'}catch{link.focus();link.select();status.textContent='Скопируйте выделенную ссылку и отправьте Александру.'}})}\n\n});;document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('a[href=\"#placement\"]').forEach(a=>a.addEventListener('click',()=>{const d=document.getElementById('placement');if(d)d.open=true}))});";
function syncPlacementFields() {
  for (const field of document.querySelectorAll('input[data-facet-list]')) {
    const list = field.list;
    const choices = Array.from(list.options, option => option.value);
    const update = () => {
      const prefix = field.value.slice(0, field.value.lastIndexOf(',') + 1).trim();
      const selected = new Set(prefix.split(',').map(value => value.trim().toLocaleLowerCase('ru')));
      const options = choices.filter(choice => !selected.has(choice.toLocaleLowerCase('ru')));
      list.replaceChildren(...options.map(choice => new Option(choice, prefix ? prefix + ' ' + choice : choice)));
    };
    field.addEventListener('input', update);
    update();
  }
  for (const checkbox of document.querySelectorAll('input[name="reviewed"]')) {
    const button = checkbox.form.querySelector('button:not([type]),button[type="submit"]');
    const syncReview = () => { button.disabled = !checkbox.checked; };
    checkbox.addEventListener('change', syncReview);
    window.addEventListener('pageshow', syncReview);
    syncReview();
  }
  const collection=document.getElementById('collection');
  if(!collection)return;
  const mode=document.getElementById('new_access'), key=document.getElementById('collection_key');
  const toggle = document.getElementById('collection-toggle');
  const newName = document.getElementById('new_collection');
  let previousCollection = collection.value==='new' ? '' : collection.value;
  toggle.hidden = false;
  collection.querySelector('option[value="new"]').hidden = true;
  const collectionMode=mode.querySelector('[value="key"]');
  const sync=()=>{
    const creating=collection.value==='new', locked=collection.selectedOptions[0]?.dataset.locked==='true';
    collection.hidden = creating;
    toggle.textContent = creating ? 'Выбрать существующую' : 'Создать коллекцию';
    toggle.setAttribute('aria-expanded',String(creating));
    document.getElementById('new-collection-fields').hidden=!creating;
    document.getElementById('new_collection').required=creating;
    collectionMode.disabled=collectionMode.hidden=!creating;
    if(!creating && mode.value==='key')mode.value='report';
    mode.options[0].textContent=locked?'По ключу коллекции':'Открытый доступ';
    const needsKey=mode.value==='key'||mode.value==='report';
    document.getElementById('password-fields').hidden=!needsKey;
    key.disabled=!needsKey;
    const saved=key.dataset.saved===mode.value;
    key.required=needsKey&&!saved;
    key.placeholder=saved?'Пароль уже задан':'От 4 до 8 символов';
    document.getElementById('master-access-note').hidden=!(locked&&mode.value==='report');
  };
  toggle.addEventListener('click', () => {
    if (collection.value==='new') {
      collection.value = previousCollection;
    } else {
      previousCollection = collection.value;
      collection.value = 'new';
    }
    sync();
    (collection.value==='new' ? newName : collection).focus();
  });
  collection.addEventListener('change',sync);
  mode.addEventListener('change',sync);
  sync();
}
function watchProcessing() {
  const panel=document.querySelector('[data-processing]');
  if(!panel)return;
  const stages=[...panel.querySelectorAll('[data-states]')];
  async function update(){
    try {
      const response=await fetch(panel.dataset.processing,{cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(response.ok){
        const {state,title,label}=await response.json();
        const index=stages.findIndex(step=>step.dataset.states.split(' ').includes(state));
        if(index<0){location.replace(location.href);return;}
        if(title)document.querySelector('main h1').textContent=title;
        const status=panel.querySelector('[role=status]');
        if(status.textContent!==label)status.textContent=label;
        stages.forEach((step,i)=>step.dataset.phase=i<index?'done':i===index?'current':'next');
      }
    } catch {}
    setTimeout(update,4000);
  }
  update();
}
const pageScript=(themeScript+';document.addEventListener("DOMContentLoaded",'+syncPlacementFields.toString()+');'+';document.addEventListener("DOMContentLoaded",'+watchProcessing.toString()+');').replace(/\r\n?/g,'\n');
const themeHash = createHash('sha256').update(pageScript).digest('base64');
function page(title, content, privatePage = true, refresh = false) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${privatePage ? '<meta name="robots" content="noindex,nofollow">' : ''}${refresh ? '<noscript><meta http-equiv="refresh" content="15"></noscript>' : ''}<title>${escape(title)} · HEMA-архив</title><link rel="icon" href="/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=JetBrains+Mono:wght@400;500;600&display=swap"><script>${pageScript}</script><style>${css}</style></head><body><a class="skip" href="#content">К содержимому</a><button id="theme-toggle" class="theme-toggle" type="button" hidden aria-label="Сменить тему"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button><div class="sheet"><header class="masthead"><a class="wordmark" href="/"><svg class="archive-mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="5" fill="currentColor"/><path d="M12 8.5v13l11-6.5zM7 25h18" fill="none" stroke="var(--paper)" stroke-width="1.8" stroke-linejoin="round"/></svg><span class="wordmark-main">HEMA-архив</span><span class="wordmark-sub">Видео об историческом фехтовании</span></a><a class="header-back" href="/">← В архив</a></header><main id="content"><nav class="breadcrumbs" aria-label="Навигация"><a href="/">Архив</a><span aria-hidden="true">/</span><a href="/submit/#my-videos">Мои видео</a></nav><h1>${escape(title)}</h1>${content}</main><footer><span>HEMA-архив · Видео об историческом фехтовании</span><a href="/stats/">Статистика архива</a></footer></div></body></html>`;
}
const login = `<p>Добавляйте записи об историческом фехтовании. После обработки владелец проверит материал и добавит его в выбранную коллекцию архива.</p><form method="post" action="/submit/login"><label for="key">Ключ автора</label><input id="key" name="key" type="password" autocomplete="current-password" required maxlength="100"><p class="hint">Для участия в пробном запуске получите личный ключ у владельца архива.</p><button>Войти</button></form>`;
const authorContacts = '<div class="author-contacts"><a href="https://vk.ru/alex_liam" target="_blank" rel="noopener noreferrer">Написать в ВКонтакте ↗</a><a href="https://t.me/Alex_Liam" target="_blank" rel="noopener noreferrer">Написать в Telegram ↗</a></div>';
const shareLink = url => `<div class="share-link"><label for="submission-link">Ссылка для Александра</label><div class="row"><input id="submission-link" value="${escape(url)}" readonly><button id="copy-link" class="secondary" type="button" hidden>Скопировать</button></div><p id="copy-status" class="hint" role="status"></p></div>`;
const intakeForm = (fields, values = {}, error = '') => `
  <form class="intake-form" method="post" action="/submit/new" data-submit-once>
    <input type="hidden" name="processing" value="archive-publication-v2">
    <input type="hidden" name="intent" value="archive">
    ${error ? '<p class="form-error" role="alert">'+escape(error)+'</p>' : ''}
    <label for="url">Ссылка на видео YouTube</label>
    <input id="url" name="url" type="url" placeholder="https://youtu.be/…" value="${escape(values.url ?? '')}" maxlength="500" aria-describedby="url-error" required>
    <p id="url-error" class="form-error" aria-live="polite" hidden></p>
    <p class="hint">После одобрения администратором разбор появится в архиве.</p>
    <label class="check"><input type="checkbox" name="consent" value="yes" required>У меня есть право на публикацию видео. Разрешаю передать аудио и расшифровку в OpenAI для разбора.</label>
    <details ${error && values.custom?'open':''}><summary>Коллекция, название и доступ</summary>
      ${fields}
    </details>
    <button type="submit">Разобрать видео</button>
  </form>`;

async function form(req) {
  let body = '';
  for await (const chunk of req) {
    if (Buffer.byteLength(body) + chunk.length > 4096) throw Error('Слишком большой запрос.');
    body += chunk;
  }
  return new URLSearchParams(body);
}



function parsePlacement(data,collections,previous,allowUnassigned,sealPassword) {
  const placement=placementInput(data,collections,allowUnassigned);
  if(placement.newAccess==='inherit')return placement;
  const key=data.get('collection_key');
  if(key && !validAccessPassword(key))throw Error(PASSWORD_ERROR);
  placement.keyHash=key?createHash('sha256').update(key).digest('hex'):previous?.newAccess===placement.newAccess?previous.keyHash:null;
  if(!placement.keyHash)throw Error('Введите пароль.');
  const sealed=key?sealPassword?.(key):previous?.newAccess===placement.newAccess?previous.keySealed:null;
  if(sealed)placement.keySealed=sealed;
  return placement;
}
function checkRequestedAccess(previous, next, collections) {
  if (!previous || !next) return;
  const protectedMode = p => p.newAccess==='report' || p.newAccess==='key' || collections.some(c=>c.slug===p.collection && c.access?.master);
  if (protectedMode(previous) && !protectedMode(next)) throw Error('Автор выбрал доступ по паролю. Сохраните защиту записи.');
}
export function submissionHandler(store, { enabled = false, pilot = false, maxMinutes = 120, archiveCollections = ()=>[],archiveReports=()=>[], nativeReader=false, setCollectionKey, sealPassword } = {}) {
  const readPlacement=(data,collections,previous,allowUnassigned=false)=>parsePlacement(data,collections,previous,allowUnassigned,sealPassword);
  return async ({ req, res, pathname, origin, owner }) => {
    const accepting = (enabled || (pilot && owner)) && Date.now() < Date.parse(TRANSCRIPTION_SUNSET);
    if (!/^\/(submit|community)(\/|$)/.test(pathname)) return false;
    const send = (code, title, content, privatePage = true, refresh = false) => {
      res.writeHead(code, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':privatePage?'private, no-store':'no-cache', 'Content-Security-Policy':`default-src 'none'; connect-src 'self'; script-src 'sha256-${themeHash}'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-src https://www.youtube-nocookie.com; form-action 'self'; base-uri 'none'; frame-ancestors 'self'` });
      res.end(req.method === 'HEAD' ? undefined : page(title, content, privatePage, refresh));
      return true;
    };
    const redirect = target => { res.writeHead(303, { Location:target }); res.end(); return true; };
    if (!store) return send(503, 'Приём видео готовится', '<p>Добавление видео пока не подключено. Вернитесь позже.</p>');
    const secure = new URL(origin).protocol === 'https:';
    const cookieName = secure ? '__Host-hema_author' : 'hema_author';
    const key = (req.headers.cookie ?? '').split(/; */).find(c => c.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    let author = owner ? 'owner' : store.author(key);
    const collections=archiveCollections().filter(c=>c.hema&&!c.catalogHidden);
    function facetInput(key, label, values) {
      const choices = new Set(values);
      for (const collection of collections) {
        for (const facets of [collection.facets, ...Object.values(collection.itemFacets ?? {})]) {
          for (const value of facets?.[key] ?? []) choices.add(value);
        }
      }
      const options = [...choices].sort((a,b) => a.localeCompare(b,'ru'));
      return `<label for="${key}">${label}</label><input id="${key}" name="${key}" list="${key}-choices" data-facet-list maxlength="250" value="${escape(values.join(', '))}" placeholder="Выберите из списка или введите своё"><datalist id="${key}-choices">${options.map(value => `<option value="${escape(value)}"></option>`).join('')}</datalist>`;
    }
    const placementFields=(p={}, sourceTitle='', optional=false)=>`<fieldset><legend>Куда добавить разбор</legend><div class="collection-choice"><label for="collection">Коллекция и раздел</label><button type="button" id="collection-toggle" aria-controls="new-collection-fields" hidden>Создать коллекцию</button></div><select id="collection" name="collection" ${optional?'':'required'}><option value="">${optional?'Выберет администратор':'Выберите коллекцию'}</option><option value="new" ${p.collection==='new'?'selected':''}>Создать новую коллекцию</option>${collections.map(c=>`<optgroup label="${escape(c.title)}"><option data-locked="${!!c.access?.master}" value="${escape(c.slug)}" ${p.collection===c.slug&&p.section==null?'selected':''}>${escape(c.title)}${c.access?.master?' · по ключу':''}</option>${(c.sections??[]).map((s,i)=>`<option data-locked="${!!c.access?.master}" value="${escape(c.slug)}:${i}" ${p.collection===c.slug&&p.section===i?'selected':''}>${escape(c.title)} — ${escape(s.title)}</option>`).join('')}</optgroup>`).join('')}</select><div id="new-collection-fields"><label for="new_collection">Название новой коллекции</label><input id="new_collection" name="new_collection" maxlength="120" value="${escape(p.newTitle??'')}"></div>
      <label for="new_access">Доступ</label>
      <select name="new_access" id="new_access">
        <option value="public">Как в коллекции</option>
        <option value="report" ${p.newAccess==='report'?'selected':''}>Пароль для этой записи</option>
        <option value="key" ${p.newAccess==='key'?'selected':''}>Пароль для новой коллекции</option>
      </select>
      <div id="password-fields"><label for="collection_key">Пароль</label>
        <input type="password" id="collection_key" name="collection_key" minlength="4" maxlength="8" autocomplete="new-password" data-saved="${p.keyHash?escape(p.newAccess):''}" placeholder="От 4 до 8 символов">
        <p class="hint" id="master-access-note" hidden>Общий ключ коллекции тоже откроет запись.</p>
      </div>
      <details class="optional-fields"><summary>Изменить название, автора и оружие</summary><label for="title">Название записи</label><input id="title" name="title" maxlength="160" placeholder="Название из YouTube" value="${escape(p.title || sourceTitle)}">${facetInput('authors','Автор или преподаватель',p.authors??[])}${facetInput('weapons','Оружие',p.weapons??[])}<p class="hint">Несколько значений разделяйте запятыми.</p></details></fieldset>`;
    function intake(data, error) {
      const [collection, section] = (data?.get('collection') || '').split(':');
      const values = {collection, section:section===undefined?null:Number(section), title:data?.get('title') || '',
        newTitle:data?.get('new_collection'), newAccess:data?.get('new_access'),
        authors:(data?.get('authors') || '').split(',').filter(Boolean), weapons:(data?.get('weapons') || '').split(',').filter(Boolean)};
      return intakeForm(placementFields(values,'',true), {url:data?.get('url'),custom:collection || values.title || values.newAccess==='report' || values.authors.length || values.weapons.length}, error);
    }
    if (req.method === 'POST') {
      if (req.headers.origin !== origin) return send(403, 'Запрос отклонён', '<p>Откройте форму на сайте и повторите действие.</p>');
      let data;
      try {
        data = await form(req);
        if (pathname === '/submit/login') {
          if (!store.author(data.get('key'))) return send(403, 'Ключ не подошёл', login);
          res.setHeader('Set-Cookie', `${cookieName}=${data.get('key')}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure ? '; Secure' : ''}`);
          return redirect('/submit/');
        }
        if (pathname === '/submit/logout') {
          res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`);
          return redirect('/submit/');
        }
        if (!author && !(enabled && pathname === '/submit/new')) return send(401, 'Вход автора', login);
        const approval = /^\/submit\/([a-f0-9]{32})\/approve-result$/.exec(pathname);
        if (approval) {
          if (!store.approveResult(approval[1],author)) return send(404,'Разбор не найден','');
          return redirect('/submit/'+approval[1]);
        }
        const control = /^\/submit\/([a-f0-9]{32})\/(stop|retry)$/.exec(pathname);
        if (control) {
          if (!owner) return send(403, 'Доступ закрыт', '<p>Управлять обработкой может только владелец.</p>');
          if (control[2] === 'retry' && store.get(control[1])?.source === 'site' && !accepting) throw Error('Приём заданий приостановлен.');
          store.control(control[1],control[2],Number(data.get('attempt')));
          return redirect('/submit/#my-videos');
        }
        const consent = /^\/submit\/([a-f0-9]{32})\/consent$/.exec(pathname);
        if (consent) {
          if (!accepting) return send(503, 'Приём приостановлен', '<p>Новые задания пока не принимаются.</p>');
          if (data.get('cloud_audio') !== 'yes') throw Error('Подтвердите отправку аудио в OpenAI.');
          store.consent(consent[1],author);
          return redirect('/submit/' + consent[1]);
        }
        if (pathname === '/submit/new') {
          if (!accepting) return send(503, 'Приём приостановлен', '<p>Обработчик пока не подключён. Новые задания не принимаются.</p>');
          if (data.get('processing') !== 'archive-publication-v2' || data.has('private_only')) throw Error('Подтвердите право на публикацию и обработку в новой форме.');
          youtubeUrl(data.get('url'));
          if (data.get('consent') !== 'yes') throw Error('Подтвердите право на обработку видео и передачу аудио OpenAI.');
          if (!author) {
            const guest=store.issue();author=guest.id;
            res.setHeader('Set-Cookie', `${cookieName}=${guest.key}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure ? '; Secure' : ''}`);
          }
          const placement=readPlacement(data,collections,null,true);
          const id = store.create(author, data.get('url'), true, {...placement, requested:true});
          const video=youtubeUrl(data.get('url'));
          void fetch('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(video),{signal:AbortSignal.timeout(3500)})
            .then(r=>r.ok?r.json():null).then(info=>{if(typeof info?.title==='string'&&info.title.trim())store.rememberTitle(id,info.title.trim());}).catch(()=>{});
          return redirect('/submit/' + id);
        }
        const place=/^\/submit\/([a-f0-9]{32})\/placement$/.exec(pathname);
        if(place){
          const row=store.get(place[1]);
          if(!row || (!owner && row.author!==author)) throw Error('Запись недоступна для изменения.');
          const placement=readPlacement(data,collections,row.placement);
          if (owner) checkRequestedAccess(row.placement,placement,collections);
          placement.requested=true;
          store.place(place[1],author,placement,owner);
          const modal=data.get('modal')==='1'?'&modal=1':'';
          return redirect('/submit/'+place[1]+'/settings?saved=1'+modal);
        }
        const decision = /^\/submit\/([a-f0-9]{32})\/(publish|reject)$/.exec(pathname);
        if (decision) {
          if (!owner) return send(403, 'Доступ закрыт', '<p>Публиковать материалы может только владелец архива.</p>');
          const publishing=decision[2]==='publish';
          const row=store.get(decision[1]);
          if (publishing && row?.state!=='review') throw Error('Заявка уже обработана.');
          const placement=publishing && data.has('collection') ? readPlacement(data,collections,row?.placement) : row?.placement;
          if (publishing) checkRequestedAccess(row.placement,placement,collections);
          if (publishing && row.draft && !passedReview(row.draft)) {
            if (data.has('collection')) store.place(row.id,author,{...placement,requested:true},true);
            return redirect('/submit/'+row.id+'/settings'+(data.has('collection')?'?saved=1':''));
          }
          const publication=publishing&&collections.length?makePublication({...row,placement},collections,archiveReports()):null;
          if (publishing && data.get('reviewed')!=='yes') throw Error('Подтвердите публикацию.');
          const credential=publication?.reportPass??publication?.newCollection?.access?.master;
          if (credential) {
            if (!setCollectionKey) throw Error('Настройка пароля недоступна.');
            setCollectionKey(credential.id,null,placement.keyHash,placement.keySealed);
          }
          store.decide(decision[1], publishing, data.get('reviewed') === 'yes',publication);
          return redirect(publication?'/reports/'+publication.report.slug+'/':'/submit/' + decision[1]);
        }
      } catch (error) {
        if(pathname === '/submit/new') return send(400, 'Добавить видео', intake(data, error.message)+'<p><a href="/submit/#my-videos">Открыть мои видео</a></p>');
        const back=/^\/submit\/([a-f0-9]{32})\//.exec(pathname);
        return send(400, 'Не удалось сохранить', `<p role="alert">${escape(error.message)}</p><a href="${back?'/submit/'+back[1]:'/submit/'}">Вернуться к видео</a>`);
      }
      return send(404, 'Страница не найдена', '');
    }
    if (!['GET','HEAD'].includes(req.method)) return send(405, 'Метод не поддерживается', '');
    if (pathname === '/community/') {
      if(collections.length)return redirect('/');
      const q = (new URL(req.url, origin).searchParams.get('q') ?? '').slice(0, 200).trim();
      const rows = store.publicList().filter(row => !q || JSON.stringify(store.get(row.id).draft).toLocaleLowerCase('ru').includes(q.toLocaleLowerCase('ru')));
      return send(200, 'Видео сообщества', `<p>Записи, добавленные авторами и проверенные владельцем архива.</p><form method="get"><label for="q">Поиск в материалах сообщества</label><div class="row"><input id="q" name="q" value="${escape(q)}" maxlength="200"><button>Найти</button></div></form>${rows.length ? `<ul class="cards">${rows.map(row => `<li><a href="/community/${row.id}">${escape(row.title)}</a></li>`).join('')}</ul>` : '<p>Пока нет опубликованных записей по этому запросу.</p>'}`, false);
    }
    const textPage=/^\/submit\/([a-f0-9]{32})\/transcript$/.exec(pathname);
    if (textPage) {
      const row=store.get(textPage[1]);
      if (!row || (!owner && row.author!==author)) return send(404,'Запись не найдена','');
      const segments=hasReadableResult(row) ? row.draft.segments : null;
      if (!segments?.length) return send(404,'Расшифровка ещё не готова','');
      const lines=segments.map(s=>`<p><a href="${escape(row.url)}&amp;t=${Math.floor(s.start)}s" target="_blank" rel="noreferrer">${time(s.start)}</a> ${escape(s.text)}</p>`).join('');
      return send(200,'Расшифровка',`<p><a href="/submit/${row.id}">К разбору</a></p>${lines}`);
    }
    const progress=/^\/submit\/([a-f0-9]{32})\/progress$/.exec(pathname);
    if(progress){
      const row=store.progress(progress[1]);
      if(!row || (!owner && row.author!==author))return send(404,'Запись не найдена','');
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private, no-store'});
      res.end(req.method==='HEAD'?undefined:JSON.stringify({state:row.state,title:row.source_title,label:states[row.state],hasTranscript:Boolean(row.has_transcript),sectionCount:row.section_count}));
      return true;
    }
    const settings = /^\/submit\/([a-f0-9]{32})\/settings$/.exec(pathname);
    if (settings) {
      const row=store.get(settings[1]);
      if (!hasReadableResult(row) || (!owner && row.author!==author)) return send(404,'Запись не найдена','');
      const back=`<p><a href="/submit/${row.id}">← К разбору</a></p>`;
      if(row.state!=='review')return send(200,states[row.state],back);
      const blocked=owner && !passedReview(row.draft);
      const action=owner && !blocked?'publish':'placement';
      const saved=new URL(req.url,origin).searchParams.has('saved');
      const modal=new URL(req.url,origin).searchParams.get('modal')==='1';
      const compact=modal?`<style>.masthead,.breadcrumbs,h1,footer,.theme-toggle,.skip{display:none!important}body,.sheet{margin:0;background:var(--paper);border:0;box-shadow:none;min-height:0;width:100%}main#content{width:auto;max-width:none;margin:0;padding:0 22px 18px}main fieldset{margin:0;padding:0;border:0}fieldset legend{display:none}main form{margin:0}label,summary{font-family:var(--font-ui)} .hint{font-size:14px}input,select{max-width:100%}</style>` : back;
      const support=`<section aria-label="Расходы на обработку"><p><strong>${escape(costText(row.draft.provenance))}</strong></p><p>Александр оплачивает обработку видео из личных средств. Если хотите помочь проекту, <a href="https://t.me/Alex_Liam" target="_blank" rel="noopener noreferrer">напишите Александру в Telegram</a> — он подскажет, как перевести деньги.</p></section>`;
      const feedback=blocked ? `<section><p>Перед публикацией нужно исправить замечания к тексту. Вы можете сохранить выбранную коллекцию.</p><details><summary>Замечания к разбору</summary><ul>${(row.draft.review?.issues??[]).map(issue=>`<li>${escape(issue)}</li>`).join('')}</ul></details></section>` : '';
      const content=saved && blocked ? '<p role="status">Коллекция сохранена.</p>' : saved ? '<p role="status"><strong>Заявка на публикацию принята.</strong> Александр увидит выбранные параметры в списке заявок.</p>' :
        `<form method="post" ${owner&&modal?'target="_top"':''} action="/submit/${row.id}/${action}"><input type="hidden" name="modal" value="${modal?'1':'0'}">${placementFields(row.placement??{}, row.source_title || row.draft.title)}
        ${owner && !blocked?'<label class="check"><input type="checkbox" name="reviewed" value="yes" required>Одобряю разбор для публикации.</label>':owner?'':'<p class="hint">Публикацию подтвердит Александр.</p>'}
        <button>${blocked?'Сохранить коллекцию':owner?'Опубликовать':row.placement?.requested?'Сохранить изменения':'Запросить публикацию'}</button></form>`;
      return send(200,'Публикация разбора',compact+feedback+content+support);
    }
    const match = /^\/(submit|community)\/([a-f0-9]{32})\/?$/.exec(pathname);
    if (match) {
      const row = store.get(match[2]);
      if (!row || (match[1] === 'community' ? row.state !== 'published' : !owner && row.author !== author)) return send(404, 'Запись не найдена', '<p>Откройте ссылку в том браузере, где отправляли видео. Если вы очистили cookies, доступ к разбору мог пропасть.</p><p><a href="/submit/">Добавить видео</a></p>');
      if(match[1]==='community'&&row.publication)return redirect('/reports/'+row.publication.report.slug+'/');
      const draft = hasReadableResult(row) ? row.draft : null;
      const privatePage = match[1] === 'submit';
      if(nativeReader && privatePage && draft && row.state==='review')return redirect('/reports/preview-'+row.id+'/');
      if(nativeReader && privatePage && row.publication)return redirect('/reports/'+row.publication.report.slug+'/');
      const processing = activeStates.includes(row.state);
      const activity = processing ? '<span class="activity-ring" aria-hidden="true"></span>' : '';
      const url = origin+'/submit/'+row.id;
      let content = privatePage ? `<p class="status" role="status">${activity}${states[row.state]}</p>${row.error?'<p role="alert">'+escape(row.error)+'</p>':''}${row.url ? `<p class="source-link"><a href="${escape(row.url)}" target="_blank" rel="noreferrer">Смотреть исходное видео на YouTube ↗</a></p>` : ''}` : '';
      if (owner && privatePage) content += ownerControls(row);
      if (draft?.presentation) content = `<p>${escape(draft.presentation.subtitle.text)}</p>` + content;
      if(privatePage && processing) {
        const phases=[['queued launching downloading','Получение видео'],['transcribing','Расшифровка речи'],['summarizing','Подготовка глав и проверка']];
        const current=phases.findIndex(([group])=>group.split(' ').includes(row.state));
        const steps=phases.map(([group,label],i)=>`<li data-states="${group}" data-phase="${i<current?'done':i===current?'current':'next'}">${label}</li>`).join('');
        const title=row.placement?.title||row.source_title||(row.url?'Видео '+new URL(row.url).searchParams.get('v'):'Обработка записи');
        const panel=`<style>.progress-steps{display:grid;gap:12px;list-style:none;padding:0;margin:20px 0}.progress-steps li{display:flex;align-items:center;gap:12px}.progress-steps li::before{content:"";width:12px;height:12px;border:1px solid var(--line-strong);border-radius:50%}.progress-steps [data-phase=current]{font-weight:bold}.progress-steps [data-phase=current]::before{background:var(--accent);border-color:var(--accent)}.progress-steps [data-phase=done]::before{content:"✓";border:0;color:var(--accent)}</style>
        <section data-processing="/submit/${row.id}/progress"><p class="hint">${row.placement?.requested?'Видео принято. Можно закрыть вкладку. Готовый разбор автоматически появится у владельца на одобрение.':'Видео принято'}</p><p role="status">${states[row.state]}</p><ol class="progress-steps">${steps}</ol><p class="hint">${row.source==='skill'?'Статус локальной обработки обновляется здесь.':'Для часового видео ориентируйтесь примерно на полчаса обработки. При очереди или дополнительной проверке ожидание может быть дольше. Готовый разбор откроется здесь автоматически.'}</p></section>`;
        return send(200,title,panel+(owner?ownerControls(row):''),true,true);
      }
      if(privatePage && row.state === 'failed') {
        const help = `<section><h2>Как получить помощь</h2><p>Скопируйте ссылку на заявку и отправьте её Александру Овчинникову во ВКонтакте или в Telegram. По ссылке он сможет проверить, почему не удалось обработать видео.</p>${shareLink(url)}${authorContacts}</section>`;
        if(row.checkpoint) return send(200,row.source_title || 'Обработка остановилась',`<p>Не удалось подготовить разбор. Запись сохранена, загружать видео повторно не нужно.</p>${help}${owner?ownerControls(row):''}`);
        content += help;
      }
      if(privatePage && row.state === 'published') content += `<p><a class="action-link" href="${row.publication?'/reports/'+row.publication.report.slug+'/':'/community/'+row.id}">Открыть разбор в архиве</a></p>`;
      if (privatePage && row.state === 'consent_required' && row.author === author) content += `<form method="post" action="/submit/${row.id}/consent"><label class="check"><input type="checkbox" name="cloud_audio" value="yes" required>Разрешаю передать аудио OpenAI для распознавания речи и расшифровку для подготовки конспекта.</label><button>Подтвердить облачную обработку</button></form>`;
      if (draft) {


        if (owner && privatePage && !draft.final_result && draft.review?.issues?.length) content += `<details><summary>Замечания к разбору (${draft.review.issues.length})</summary><ul>${draft.review.issues.map(item=>`<li>${escape(item)}</li>`).join('')}</ul></details>`;
        const videoId = new URL(row.url).searchParams.get('v');
        const notes=draft.materials?.notes ?? [], exercises=draft.materials?.exercises ?? [], glossary=draft.materials?.glossary ?? [];
        content += `<iframe title="Видеозапись" src="https://www.youtube-nocookie.com/embed/${escape(videoId)}" allowfullscreen loading="lazy"></iframe><p class="hint">Материалы подготовлены по распознанной речи; движения, не описанные словами, не реконструируются.</p><nav aria-label="Разделы разбора"><a href="#main-points">Кратко о видео</a><a href="#chapters">Главы</a>${notes.length ? '<a href="#notes">Конспект</a>' : ''}${exercises.length ? '<a href="#exercises">Упражнения</a>' : ''}<a href="#transcript">Расшифровка</a></nav><section id="main-points"><h2>Кратко о видео</h2><p>${escape(draft.overview.map(item => item.text).join(' '))}</p></section>`;
        if (draft.limitations?.length) content += `<aside><strong>Что требует сверки с записью</strong><ul>${draft.limitations.map(item=>`<li><a href="${escape(row.url)}&amp;t=${Math.floor(draft.segments[item.first].start)}s" target="_blank" rel="noreferrer">${time(draft.segments[item.first].start)}</a> — ${escape(item.reader_text ?? item.reason)}</li>`).join('')}</ul></aside>`;
        content += '<h2 id="chapters">Главы</h2>';
        for (const chapter of draft.chapters) {
          content += `<section><h3>${escape(chapter.title.text)}</h3><a href="${escape(row.url)}&amp;t=${Math.floor(chapter.start)}s" target="_blank" rel="noreferrer">Смотреть с ${time(chapter.start)}</a><p>${escape(chapter.summary.text)}</p><ul>${chapter.points.map(p => `<li>${escape(p.text)}</li>`).join('')}</ul></section>`;
        }
        if (notes.length) content += `<h2 id="notes">Конспект</h2>${notes.map(n=>`<section><h3>${escape(n.title.text)}</h3><ul>${n.items.map(item=>`<li>${escape(item.text)}</li>`).join('')}</ul></section>`).join('')}`;
        if (exercises.length) content += `<h2 id="exercises">Упражнения</h2>${exercises.map(group=>`<section><h3>${escape(group.title.text)}</h3>${group.items.map(item=>`<p><a href="${escape(row.url)}&amp;t=${Math.floor(item.start)}s" target="_blank" rel="noreferrer">Смотреть с ${time(item.start)}</a></p><ul>${item.claims.map(c=>`<li>${escape(c.text)}</li>`).join('')}</ul>`).join('')}</section>`).join('')}`;
        if (glossary.length) content += `<section><h2>Термины из записи</h2><dl>${glossary.map(item=>`<dt>${escape(item.term.text)}</dt><dd>${escape(item.definition.text)}</dd>`).join('')}</dl></section>`;
        content += `<details id="transcript"><summary>Расшифровка</summary>${draft.segments.map(s => `<p><a href="${escape(row.url)}&amp;t=${Math.floor(s.start)}s" target="_blank" rel="noreferrer">${time(s.start)}</a> ${escape(s.text)}</p>`).join('')}</details>`;
      if(privatePage && row.state === 'review') {
        content += `<p role="status">${row.placement?.requested?'Заявка передана владельцу на проверку.':'Черновик'}</p><a href="/submit/${row.id}/settings">${owner?'Проверить параметры публикации':row.placement?.requested?'Параметры публикации':'Запросить публикацию'}</a>`;
      }
        if (privatePage && owner && !draft.final_result) {
          if (draft.presentation && draft.review?.issues?.length) content += `<p role="status">${draft.review.issues.map(escape).join(' ')}</p>`;
          content += `<details><summary>Основания и диагностика для проверки</summary><pre>${escape(JSON.stringify({ overview:draft.overview, chapters:draft.chapters, materials:draft.materials, source_coverage:draft.source_coverage, terminology:draft.terminology, flags:draft.flags, review:draft.review }, null, 2))}</pre></details>`;
          if (row.state === 'review') content += `<form method="post" action="/submit/${row.id}/publish"><label class="check"><input type="checkbox" name="reviewed" value="yes" required>Я сверил все тезисы и главы с источником, проверил спорные фрагменты, полноту тем и право на размещение в выбранной коллекции.</label><button>Одобрить и добавить в архив</button></form><form method="post" action="/submit/${row.id}/reject"><button class="secondary">Отклонить</button></form>`;
        }
        if (privatePage && row.state === 'published') content += `<p><a href="${row.publication?'/reports/'+row.publication.report.slug+'/':'/community/'+row.id}">Открыть опубликованную страницу в архиве</a></p>`;
      }
      if (privatePage && draft && ['review','published'].includes(row.state)) {
        content += `<section><h2>Поддержать архив</h2><p><strong>${escape(costText(draft.provenance))}</strong></p><p>Александр Овчинников оплачивает обработку видео из личных средств. Если разбор вам пригодился и вы хотите помочь с расходами, напишите Александру. Он подскажет, как сделать перевод.</p>${authorContacts}</section>`;
      }
      return send(200, row.publication?.report?.title ?? (draft && row.placement?.title || draft?.presentation?.title?.text) ?? draft?.title ?? row.placement?.title ?? (row.state === 'stopped' ? states.stopped : row.state === 'failed' ? 'Видео не обработано' : 'Готовим разбор'), content, privatePage, privatePage && processing);
    }
    if (pathname !== '/submit/') return send(404, 'Страница не найдена', '');
    if (!author && !enabled) return send(200, 'Добавить видео', login);
    const rows = author ? store.list(author, owner) : [];
    return send(200, 'Добавить видео', `${accepting ? intake() : '<aside>Приём новых видео приостановлен. Ваши видео доступны ниже.</aside>'}<section class="my-videos" id="my-videos" ${owner ? 'data-owner-list' : ''}><h2>${owner ? 'Все видео' : 'Мои видео'}</h2>${rows.length ? `<ul class="cards">${rows.map(row => `<li><a class="video-entry" href="/submit/${row.id}"><span>${escape(row.title || 'Видео с YouTube')}<small>${escape(new Date(row.created).toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'Asia/Qyzylorda'}))}</small></span><span class="entry-action">${row.state==='review'||row.state==='published'?'Открыть разбор':'Подробнее'} →</span></a><span class="status">${owner ? (row.source === 'skill' ? 'Локальный скилл · ' : 'Заявка с сайта · ') : ''}${row.state==='review'&&row.requested?'Ожидает публикации':states[row.state]}</span>${owner&&row.state==='review'&&row.requested?'<a href="/submit/'+row.id+'/settings">Проверить и опубликовать</a>':''}${owner ? ownerControls(row) : ''}</li>`).join('')}</ul>` : '<p class="hint">Здесь появятся отправленные видео и готовые разборы.</p>'}</section>${author && !owner ? '<details><summary>Доступ в этом браузере</summary><p class="hint">Выход скроет ваши видео в этом браузере. Сохранённая ссылка сама по себе не восстановит доступ.</p><form method="post" action="/submit/logout"><button class="secondary">Выйти</button></form></details>' : ''}`);
  };
}

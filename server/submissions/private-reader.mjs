import {hasReadableResult} from './result-ready.mjs';
import { readerRecord } from './publication.mjs';
import { pageMetadata } from '../metadata.mjs';

// Fixed display estimate, Bank of Russia USD/RUB rate effective 2026-11-07.
const rublesPerDollar = 82.1386;
const rubles = new Intl.NumberFormat('ru-RU', {style:'currency', currency:'RUB', maximumFractionDigits:0, minimumFractionDigits:0});
const validCost = value => Number.isFinite(value) && value >= 0;

export function costText(provenance) {
  let usd = provenance?.processing_estimate_usd;
  if (!validCost(usd)) {
    const range = provenance?.processing_estimate_range_usd;
    if (!Array.isArray(range) || range.length !== 2 || !range.every(validCost) || range[1] < range[0]) {
      return 'Расходы на обработку пока не рассчитаны.';
    }
    usd = (range[0] + range[1]) / 2;
  }
  const estimate = usd * rublesPerDollar;
  if (estimate > 0 && estimate < 0.5) return 'Обработка видео стоила меньше 1 ₽.';
  return `Обработка видео стоила около ${rubles.format(estimate)}.`;
}

export function privateRecord(store, req, origin, owner, id) {
  const cookie = origin.protocol==='https:' ? '__Host-hema_author=' : 'hema_author=';
  const token = (req.headers.cookie ?? '').split(/; */).find(value => value.startsWith(cookie))?.slice(cookie.length);
  const row = store?.get(id);
  if (!hasReadableResult(row) || (!owner && row.author!==store.author(token))) return null;
  return {row,...readerRecord(row,'preview-'+id)};
}

export function servePrivateReader({req, pathname, reply, origin, owner, store, shell}) {
  const route = /^\/(reports|api\/reports|transcripts)\/preview-([a-f0-9]{32})(\/|\.chapters\.json|\.json)?$/.exec(pathname);
  if (!route) return false;
  const [,kind,id,suffix=''] = route;
  if (!['GET','HEAD'].includes(req.method)) {reply(405);return true;}
  const data = privateRecord(store,req,origin,owner,id);
  if (!data) {reply(404);return true;}
  const {row,report,transcript} = data;
  if (kind==='api/reports' && !suffix) reply(200,JSON.stringify(report),'application/json');
  else if (kind==='transcripts' && ['.chapters.json','.json'].includes(suffix)) reply(200,JSON.stringify(suffix==='.json'?{transcript:transcript.transcript}:{chapters:transcript.chapters}),'application/json');
  else if (kind==='reports' && (!suffix || suffix==='/')) {
    const summary={slug:report.slug,title:report.title,tags:report.tags};
    const catalog={collections:[],reports:[summary],graph:{links:[]},unlocked:[]};
    const head=pageMetadata(pathname,origin.origin,[],[summary],()=>false)+'<script>globalThis.__hema='+JSON.stringify(catalog).replaceAll('<','\\u003c')+'</script>';
    const settings='/submit/'+id+'/settings';
    let bar='';
    if (row.state==='review') {
      if (row.draft.final_result && !owner) {
        if (row.placement?.approvedResult) {
          bar=`<aside aria-label="Статус публикации" style="padding:12px 20px;border-bottom:1px solid var(--line);background:var(--paper);color:var(--ink);font:normal 1rem/1.5 var(--font-ui,sans-serif)">
            <div style="max-width:74ch;margin:auto"><strong>Вы одобрили разбор. Теперь его проверит Александр Овчинников.</strong>
            <p style="margin:.25rem 0">Александр старается проверить разбор в течение суток. Если всё в порядке, он опубликует его в архиве.</p>
            <a href="/submit/#my-videos">Посмотреть статус в «Моих видео»</a>. Если прошли сутки, напишите Александру в <a href="https://t.me/Alex_Liam" target="_blank" rel="noopener noreferrer">Telegram</a> или <a href="https://vk.ru/alex_liam" target="_blank" rel="noopener noreferrer">ВКонтакте</a>.</div></aside>`;
        } else {
          bar=`<aside aria-label="Готовый разбор" style="display:flex;align-items:center;justify-content:center;gap:1rem;padding:.6rem;background:var(--paper);color:var(--ink)"><span>Разбор готов</span><form method="post" action="/submit/${id}/approve-result"><ui-button><button type="submit">Одобрить разбор</button></ui-button></form></aside>`;
        }
      } else bar=publicationBar(settings,Boolean(row.placement?.requested));
    }
    reply(200,shell.replace('<head>',()=>'<head><script type="module" src="/_app/server-forms.js"></script>'+head).replace(/<body[^>]*>/,tag=>tag+bar),'text/html; charset=utf-8');
  } else reply(404);
  return true;
}

function publicationBar(settings,requested) {
  return `<style>
.pub-strip{position:sticky;top:0;z-index:55;background:var(--paper,#f4f0e6);border-bottom:1px solid var(--line,#d4ccbb);color:var(--ink)}
.pub-strip-inner{max-width:1200px;margin:auto;padding:6px clamp(12px,3vw,32px);display:flex;align-items:center;justify-content:space-between;gap:10px;font:14px/1.35 var(--font-ui,sans-serif)}
.pub-strip-inner span{color:var(--ink-soft)}
.pub-open{display:inline-flex;align-items:center;min-height:40px;padding:0 16px;background:var(--accent,#923c24);color:var(--on-action,#fff);border-radius:var(--radius,4px);font-weight:600;text-decoration:none}
.pub-dialog{position:fixed;inset:0;margin:auto;height:fit-content;z-index:101;width:min(460px,calc(100vw - 24px));max-width:100%;max-height:90dvh;padding:0;color:var(--ink);background:var(--paper,#f4f0e6);border:1px solid var(--line-strong);border-radius:8px;box-shadow:0 20px 80px #0003}
.pub-dialog::backdrop,.pub-backdrop{background:#17140faa}.pub-backdrop{position:fixed;inset:0;z-index:100}.pub-dialog header{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 0 22px}
.pub-dialog h2{margin:0;font:500 26px/1.2 var(--font-display,serif)}.pub-dialog button{width:44px;height:44px;border:0;background:transparent;color:inherit;font:26px/1 sans-serif;cursor:pointer}
.pub-dialog iframe{display:block;width:100%;height:300px;max-height:calc(90dvh - 66px);border:0}
html:has(.pub-dialog:not([hidden])){overflow:hidden}
</style>
<aside class="pub-strip" aria-label="Публикация"><div class="pub-strip-inner"><span role="status">${requested?'Ожидает публикации':'Разбор готов'}</span><a class="pub-open" data-sveltekit-reload href="${settings}" aria-haspopup="dialog">${requested?'Параметры публикации':'Начать публикацию'}</a></div></aside>
<ui-dialog id="publication-dialog"><ui-dialog-backdrop class="pub-backdrop" hidden></ui-dialog-backdrop><ui-dialog-content class="pub-dialog" hidden><header><ui-dialog-title><h2>Публикация разбора</h2></ui-dialog-title><ui-dialog-close><button type="button" aria-label="Закрыть">×</button></ui-dialog-close></header><iframe title="Параметры публикации"></iframe></ui-dialog-content></ui-dialog>
<script>(()=>{
 const link=document.querySelector('.pub-open'),dialog=document.getElementById('publication-dialog'),frame=dialog.querySelector('iframe');
 const status=document.querySelector('.pub-strip [role=status]');
 let observer,watching=false;
 async function watchPublication(){
   if(watching)return;
   watching=true;
   async function poll(){
     try {
       const res=await fetch('${settings.replace('/settings','/progress')}',{cache:'no-store',signal:AbortSignal.timeout(8000)});
       if(res.ok){
         const info=await res.json();
         if(info.state==='published'){
           status.textContent='Опубликовано';link.textContent='Посмотреть публикацию';link.href='${settings.replace('/settings','')}';link.removeAttribute('aria-haspopup');return;
         }
         if(info.state!=='review'){location.replace('${settings.replace('/settings','')}');return;}
       }
     } catch {}
     setTimeout(poll,8000);
   }
   poll();
 }
 if(${requested})watchPublication();
 link.addEventListener('click',e=>{
   if(!link.hasAttribute('aria-haspopup')||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||!customElements.get('ui-dialog'))return;
   e.preventDefault();dialog.open=true;frame.src=link.href+'?modal=1';
 });
 dialog.addEventListener('openchange',event=>{
   if(!event.detail.value){observer?.disconnect();queueMicrotask(()=>link.focus());}
 });
 frame.onload=()=>{
   observer?.disconnect();const doc=frame.contentDocument,main=doc?.querySelector('main');if(!main)return;
   if(new URL(doc.URL).searchParams.has('saved')){status.textContent='Ожидает публикации';link.textContent='Параметры публикации';watchPublication();}
   const resize=()=>frame.style.height=Math.ceil(main.getBoundingClientRect().height+4)+'px';
   observer=new ResizeObserver(resize);observer.observe(main);resize();
   doc.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dialog.open=false}});
 };
})()</script>`;
}

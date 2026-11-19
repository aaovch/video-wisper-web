export const intakeFooter = `<style>

.archive-intake-footer { width:calc(100% - clamp(24px,4vw,72px)); max-width:1360px; margin:0 auto; padding:0 28px 40px; border:1px solid var(--line); border-top:0; background:var(--paper); color:var(--ink); }
.archive-intake-invitation { max-width:1144px; margin:auto; padding:28px 32px; display:flex; align-items:center; justify-content:space-between; gap:24px; border:1px solid var(--line-strong); border-left:3px solid var(--accent); background:var(--surface); border-radius:var(--radius); }
.archive-intake-copy strong { display:block; margin-bottom:6px; font:500 clamp(23px,3vw,28px)/1.2 var(--font-display); letter-spacing:-.02em; }
.archive-intake-copy p { margin:0; color:var(--ink-soft); font:17px/1.5 var(--font-body); }
.archive-intake-link { display:inline-flex; flex-shrink:0; align-items:center; justify-content:center; gap:18px; min-height:48px; padding:12px 20px; border:1px solid var(--accent); border-radius:var(--radius); background:var(--accent); color:var(--on-action); font:500 15px/1.5 var(--font-ui); text-decoration:none; }
.archive-intake-link:hover { background:var(--accent-ink); text-decoration:none; }
.archive-intake-link svg { transition:transform .18s ease; }
.archive-intake-link:hover svg { transform:translateX(3px); }
.archive-intake-link:focus-visible { outline:3px solid var(--focus); outline-offset:4px; }
@media(max-width:960px) { .archive-intake-footer {width:100%;border:0;} }
@media(max-width:600px) { .archive-intake-footer {padding:0 16px 28px;}.archive-intake-invitation {padding:22px;flex-direction:column;align-items:stretch;gap:18px;}.archive-intake-link {width:100%;} }

@media(prefers-reduced-motion:reduce) { .archive-intake-link svg {transition:none;}::view-transition-old(root),::view-transition-new(root) {animation:none;} }
</style><aside class="archive-intake-footer" aria-label="Добавление материалов"><div class="archive-intake-invitation"><div class="archive-intake-copy"><strong>Есть запись тренировки или семинара?</strong><p>Превратите видео в главы, тезисы и расшифровку.</p></div><a class="archive-intake-link" href="/submit/">Добавить своё видео<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></a></div></aside>`;

export function addIntakeLinks(html) {
  return html.replace('</body>', () => intakeFooter + '</body>');
}

export function matchesAccess(searchText,kind,query,filter) {
  const normalize=value=>String(value).toLocaleLowerCase('ru').replaceAll('ё','е');
  return (filter==='all'||(filter==='collection'?kind==='collection':kind!=='collection')) &&
    normalize(query).trim().split(/\s+/).every(word=>normalize(searchText).includes(word));
}

export function bindPasswordAdmin(root=document) {
  const tools=root.querySelector('[data-admin-tools]');
  if (!tools) return;
  const search=tools.querySelector('[data-access-search]');
  const filter=tools.querySelector('[data-access-filter]');
  const count=root.querySelector('[data-access-count]');
  const empty=root.querySelector('[data-access-empty]');
  const rows=[...root.querySelectorAll('[data-access-row]')];
  const resets=[...root.querySelectorAll('[data-reset-access]')];
  function update() {
    let visible=0;
    for (const row of rows) {
      row.hidden=!matchesAccess(row.dataset.search,row.dataset.kind,search.value,filter.value);
      if (!row.hidden) visible++;
    }
    count.textContent=`Показано ${visible} из ${rows.length}`;
    empty.hidden=visible!==0;
    for (const reset of resets) reset.hidden=!search.value&&filter.value==='all';
  }
  search.addEventListener('input',update);
  filter.addEventListener('change',update);
  search.addEventListener('keydown',event=>{
    if(event.key==='Escape'){search.value='';update();}
  });
  for(const reset of resets)reset.addEventListener('click',()=>{search.value='';filter.value='all';update();search.focus();});
  for(const row of rows) {
    const editor=row.querySelector('details');
    const cancel=row.querySelector('[data-cancel-password]');
    if (!editor||!cancel) continue;
    cancel.hidden=false;
    cancel.addEventListener('click',()=>{
      row.querySelector('form').reset();
      editor.open=false;
      editor.querySelector('summary').focus();
    });
  }
  tools.hidden=false;
  update();
}
if(typeof document!=='undefined')bindPasswordAdmin();

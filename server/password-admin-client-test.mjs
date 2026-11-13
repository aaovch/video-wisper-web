import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesAccess, bindPasswordAdmin } from './password-admin-client.js';

test('search matches words in titles and collections regardless of case, order or ё',()=>{
  const text='Семинар «Батманы на мече» Пётр Васильев';
  for(const query of ['','  ','ПЕТР','васильев батманы','мече семинар']) assert(matchesAccess(text,'recording',query,'all'));
  assert(!matchesAccess(text,'recording','батманы сабля','all'));
  assert(!matchesAccess(text,'recording','','collection'));
  assert(matchesAccess(text,'recording','','recording'));
  assert(matchesAccess('Два семинара','package','','recording'));
  assert(!matchesAccess('Вся коллекция','collection','','recording'));
});

function control(extra={}) {
  return {hidden:true,value:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},focus(){this.focused=true;},...extra};
}
test('filtering, empty state and reset update together; cancelling editing clears the draft and restores focus',()=>{
  const search=control(),filter=control({value:'all'}),count={},empty={hidden:true},reset=control();
  const editor={open:true},summary=control(),cancel=control();
  editor.querySelector=()=>summary;
  const form={reset(){this.didReset=true;}};
  const makeRow=(title,kind)=>({hidden:false,dataset:{search:title,kind},querySelector:s=>({'details':editor,'[data-cancel-password]':cancel,'form':form})[s]});
  const row=makeRow('Батманы Пётр Васильев','recording');
  const other={hidden:false,dataset:{search:'Асламов','kind':'collection'},querySelector:()=>null};
  const tools=control({querySelector:s=>({'[data-access-search]':search,'[data-access-filter]':filter})[s]});
  const root={querySelector:s=>({'[data-admin-tools]':tools,'[data-access-count]':count,'[data-access-empty]':empty})[s],querySelectorAll:s=>s==='[data-access-row]'?[row,other]:[reset]};
  bindPasswordAdmin(root);
  assert(!tools.hidden);assert.equal(count.textContent,'Показано 2 из 2');assert(reset.hidden);assert(!cancel.hidden);
  search.value='петр';search.listeners.input();
  assert(!row.hidden);assert(other.hidden);assert.equal(count.textContent,'Показано 1 из 2');assert(!reset.hidden);
  filter.value='collection';filter.listeners.change();
  assert(row.hidden&&other.hidden);assert(!empty.hidden);
  reset.listeners.click();assert(search.focused);assert(!row.hidden&&!other.hidden);assert(empty.hidden);assert.equal(filter.value,'all');
  search.value='сабля';search.listeners.input();search.listeners.keydown({key:'Escape'});assert(!row.hidden&&!other.hidden);
  cancel.listeners.click();assert(form.didReset);assert(!editor.open);assert(summary.focused);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { passwordShareTargets, passwordAccessMessage } from './password-share.mjs';
import { bindAccessCopies } from './password-share-client.js';

const collections=[{slug:'course',title:'Курс фехтования',access:{master:{id:'course'},passes:[
  {id:'recording',title:'Работа в соединении',items:['lesson-one']},
  {id:'package',title:'Два семинара',items:['lesson-one','lesson-two']}
]}}];

test('shared access links open the collection, one recording or a multi-recording package in its collection', () => {
  const targets=passwordShareTargets(collections,'https://archive.example');
  assert.equal(targets.get('course').url,'https://archive.example/collections/course/');
  assert.equal(targets.get('recording').url,'https://archive.example/reports/lesson-one/?from=course');
  assert.equal(targets.get('package').url,'https://archive.example/collections/course/');
  const encoded=passwordShareTargets([{slug:'курс / один',title:'Тест',access:{passes:[{id:'pass',items:['урок / один']}]}}],'https://archive.example');
  const url=new URL(encoded.get('pass').url);
  assert.equal(decodeURIComponent(url.pathname),'/reports/урок / один/');
  assert.equal(url.searchParams.get('from'),'курс / один');
});

test('a forwarding message contains the title, direct URL and exact password on three lines', () => {
  const target=passwordShareTargets(collections,'https://archive.example').get('recording');
  const password='синтетический-<&"-пароль';
  assert.equal(passwordAccessMessage(target,password),`Работа в соединении\nhttps://archive.example/reports/lesson-one/?from=course\nПароль: ${password}`);
  assert(!target.url.includes(password));
});

function accessRow(value) {
  let click;
  const button={hidden:true,disabled:false,addEventListener:(type,listener)=>{assert.equal(type,'click');click=listener;}};
  const message={value,hidden:true,focused:false,selected:false,focus(){this.focused=true;},select(){this.selected=true;}};
  const status={textContent:''};
  const elements={'[data-copy-access]':button,'[data-access-message]':message,'[data-copy-status]':status};
  return {button,message,status,querySelector:selector=>elements[selector],click:()=>click()};
}
const documentFor=rows=>({querySelectorAll:selector=>{assert.equal(selector,'[data-password-access]');return rows;}});

test('each copy button copies its own password and destination without changing either value', async () => {
  const targets=passwordShareTargets(collections,'https://archive.example');
  const first=accessRow(passwordAccessMessage(targets.get('course'),'synthetic-collection-pass'));
  const second=accessRow(passwordAccessMessage(targets.get('recording'),'synthetic-recording-pass'));
  const copied=[];
  bindAccessCopies(documentFor([first,second]),{writeText:async text=>copied.push(text)});
  assert(!first.button.hidden);assert(!second.button.hidden);
  await second.click();await first.click();
  assert.deepEqual(copied,[second.message.value,first.message.value]);
  for(const row of [first,second]){assert.equal(row.status.textContent,'Доступ скопирован. Можно переслать.');assert(!row.button.disabled);assert(row.message.hidden);}
});

test('clipboard denial reveals and selects the same message; a successful retry hides the fallback', async () => {
  const row=accessRow('Синтетический доступ\nhttps://archive.example/collections/course/\nПароль: synthetic-password');
  let attempts=0,copied;
  bindAccessCopies(documentFor([row]),{writeText:async text=>{if(++attempts===1)throw Error('Permission denied');copied=text;}});
  await row.click();
  assert(!row.message.hidden);assert(row.message.focused);assert(row.message.selected);assert(!row.button.disabled);
  assert.equal(row.status.textContent,'Скопируйте выделенный текст вручную.');
  await row.click();assert.equal(copied,row.message.value);assert(row.message.hidden);assert(!row.button.disabled);
});

test('browsers without clipboard support still provide selected text for manual copying', async () => {
  const row=accessRow('Синтетический доступ');
  bindAccessCopies(documentFor([row]),undefined);
  await row.click();assert(row.message.focused);assert(row.message.selected);assert(!row.message.hidden);assert(!row.button.disabled);
});

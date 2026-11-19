import { applyTheme } from '../src/lib/theme-preference.ts';
import '@ui-sdk/web/autocomplete';
import '@ui-sdk/web/toggle';
import '@ui-sdk/web/button';
import '@ui-sdk/web/input';
import '@ui-sdk/web/dialog';
import '@ui-sdk/web/textarea';
import '@ui-sdk/web/checkbox';
import '@ui-sdk/web/select';
import '@ui-sdk/web/collapsible';

const element = tag => document.createElement(tag);

function transferAttributes(source, target) {
  for (const { name, value } of source.attributes) target.setAttribute(name, value);
}

// Keep the server forms usable until the module and all elements have loaded.
for (const input of document.querySelectorAll('[data-sdk-forms] input[type="checkbox"]')) {
  const checkbox = element('ui-checkbox');
  transferAttributes(input, checkbox);
  checkbox.removeAttribute('type');
  const indicator = element('ui-checkbox-indicator');
  indicator.textContent = '✓';
  checkbox.append(indicator);
  checkbox.addEventListener('checkedchange', () => queueMicrotask(() => {
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  input.replaceWith(checkbox);
  checkbox.checked = input.checked;
}

function selectItem(option, groupDisabled = false) {
  const item = element('ui-select-item');
  transferAttributes(option, item);
  item.setAttribute('value', option.value);
  if (groupDisabled) item.setAttribute('disabled', '');
  item.textContent = option.label;
  return item;
}

for (const native of document.querySelectorAll('[data-sdk-forms] select')) {
  const select = element('ui-select');
  transferAttributes(native, select);
  const trigger = element('ui-select-trigger');
  const button = element('button');
  button.type = 'button';
  for (const label of native.labels) {
    label.id ||= (native.id || native.name || 'access-filter') + '-label';
    button.setAttribute('aria-labelledby', label.id);
  }
  button.append(element('ui-select-value'));
  trigger.append(button);
  const content = element('ui-select-content');
  content.hidden = true;
  for (const choice of native.children) {
    if (choice instanceof HTMLOptGroupElement) {
      const group = element('ui-select-group');
      const label = element('ui-select-group-label');
      label.textContent = choice.label;
      group.hidden = choice.hidden;
      group.append(label);
      for (const option of choice.children) group.append(selectItem(option, choice.disabled));
      content.append(group);
    } else if (choice instanceof HTMLOptionElement) {
      content.append(selectItem(choice));
    }
  }
  select.append(trigger, content);
  select.setAttribute('default-value', native.value);
  select.addEventListener('valuechange', () => queueMicrotask(() => {
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  native.replaceWith(select);
}

for (const details of document.querySelectorAll('[data-sdk-forms] details')) {
  const summary = details.querySelector(':scope > summary');
  if (!summary) continue;
  const collapsible = element('ui-collapsible');
  transferAttributes(details, collapsible);
  if (details.open) collapsible.setAttribute('default-open', '');
  const trigger = element('ui-collapsible-trigger');
  const button = element('button');
  button.type = 'button';
  transferAttributes(summary, button);
  button.append(...summary.childNodes);
  trigger.append(button);
  summary.remove();
  const panel = element('ui-collapsible-panel');
  panel.hidden = !details.open;
  panel.append(...details.childNodes);
  collapsible.append(trigger, panel);
  details.replaceWith(collapsible);
}


const themeToggle = document.querySelector('[data-sdk-forms] ui-toggle:has(#theme-toggle)');
if (themeToggle) {
  themeToggle.pressed = document.documentElement.dataset.theme === 'dark';
  themeToggle.addEventListener('pressedchange', event => {
    applyTheme(event.detail.value ? 'dark' : 'light');
  });
  themeToggle.querySelector('button').hidden = false;
}

for (const field of document.querySelectorAll('[data-sdk-forms] ui-autocomplete')) {
  const input = field.querySelector('input');
  const choices = field.querySelector('datalist');
  // The native list serves the same options until the SDK takes over.
  field.items = Array.from(choices.options, option => option.value);
  input.removeAttribute('list');
  choices.remove();
  field.filter = (item, text) => {
    const parts = text.toLocaleLowerCase('ru').split(',').map(part => part.trim());
    const query = parts.pop();
    const label = item.label.toLocaleLowerCase('ru');
    return !parts.includes(label) && label.includes(query);
  };
  field.addEventListener('valuechange', event => {
    if (event.detail.reason !== 'item-press') return;
    const prefix = field.value.slice(0, field.value.lastIndexOf(',') + 1);
    if (!prefix) return;
    event.preventDefault();
    field.value = prefix + ' ' + event.detail.value;
    field.open = false;
  });
}

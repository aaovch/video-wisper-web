export function bindAccessCopies(root=document,clipboard=globalThis.navigator?.clipboard) {
  for (const row of root.querySelectorAll('[data-password-access]')) {
    const button = row.querySelector('[data-copy-access]');
    const message = row.querySelector('[data-access-message]');
    const status = row.querySelector('[data-copy-status]');
    if (!button || !message || !status) continue;
    button.hidden = false;
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = '';
      try {
        if (!clipboard?.writeText) throw Error('Clipboard unavailable');
        await clipboard.writeText(message.value);
        message.hidden = true;
        status.textContent = 'Доступ скопирован. Можно переслать.';
      } catch {
        message.hidden = false;
        message.focus();
        message.select();
        status.textContent = 'Скопируйте выделенный текст вручную.';
      } finally { button.disabled = false; }
    });
  }
}

if (typeof document !== 'undefined') bindAccessCopies();

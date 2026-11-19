import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { archiveServer } from '../../server/archive.mjs';
import { openAccessStore } from '../../server/access-store.mjs';

test('справочник открывается с диска и поддерживает управление с клавиатуры', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve('docs/design-system.html')).href);
  const theme = page.getByRole('button', { name: 'Тёмная тема' });
  await theme.press('Space');
  await expect(theme).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const search = page.getByRole('searchbox');
  await search.fill('выпад');
  await expect(page.locator('#feedback')).toContainText('Найден 1');
  const filter = page.getByRole('checkbox', { name: 'Рапира' });
  await filter.press('Space');
  await expect(page.locator('#feedback')).toContainText('Совпадений нет');
  await filter.press('Space');
  await expect(page.locator('#feedback')).toContainText('Найден 1');
  const trigger = page.getByRole('button', { name: 'Пример ввода ключа' });
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Доступ к коллекции' });
  const key = dialog.getByLabel('Учебный ключ');
  await expect(key).toBeFocused();
  await key.fill('wrong');
  await key.press('Enter');
  await expect(dialog.getByRole('status')).toContainText('Ключ не подошёл');
  await key.fill('demo');
  await dialog.getByRole('button', { name: 'Применить ключ' }).click();
  await expect(dialog.getByRole('status')).toContainText('Учебный ключ принят');
  await key.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(key).toHaveValue('');
  await dialog.getByRole('button', { name: 'Закрыть' }).click();
  await expect(dialog).toBeHidden();
  const reader = page.getByRole('button', { name: 'Образец чтения главы' });
  await reader.press('Enter');
  await expect(reader).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#reader ui-collapsible-panel')).toBeVisible();
  expect(errors).toEqual([]);
});

test('пилот принимает выданный CLI ключ и отзывает доступ у действующей сессии', async ({ page, browser }, info) => {
  const db = info.outputPath('pilot.sqlite');
  const store = openAccessStore(db);
  const cli = (...args: string[]) => execFileSync(process.execPath, ['server/archive.mjs', ...args], {
    encoding: 'utf8', env: { ...process.env, HEMA_ACCESS_DB: db }
  }).trim();
  const scope = 'noname-training:longsword-cycles';
  const origin = 'http://127.0.0.1:4196';
  const report = origin + '/reports/prostaya-ataka-mikrotsikl-1-dlinnyy-mech/';
  const server = archiveServer(store, origin).listen(4196, '127.0.0.1');
  await once(server, 'listening');
  const plain = await browser.newContext({ javaScriptEnabled: false });
  try {
    expect(cli('scopes').split(/\r?\n/)).toContain(scope);
    const key = cli('issue', scope);
    await page.goto(origin);
    await page.waitForFunction(() => !!customElements.get('ui-button') && !!customElements.get('ui-input'));
    await page.getByRole('searchbox', { name: 'Поиск' }).fill('дистанция');
    await page.getByRole('button', { name: 'Найти' }).click();
    expect(new URL(page.url()).searchParams.get('q')).toBe('дистанция');
    expect((await page.goto(report))?.status()).toBe(403);
    await page.getByLabel('Ключ доступа').fill(key);
    await page.getByRole('button', { name: 'Открыть доступ' }).click();
    await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
    expect((await page.goto(report))?.status()).toBe(200);
    const noJs = await plain.newPage();
    await noJs.goto(report);
    await noJs.getByLabel('Ключ доступа').fill(key);
    await noJs.getByRole('button', { name: 'Открыть доступ' }).click();
    await expect(noJs.getByRole('button', { name: 'Выйти' })).toBeVisible();
    expect((await noJs.goto(report))?.status()).toBe(200);
    await noJs.goto(origin);
    await noJs.getByRole('button', { name: 'Выйти' }).click();
    await expect(noJs.getByLabel('Ключ доступа')).toBeVisible();
    expect((await noJs.goto(report))?.status()).toBe(403);
    cli('revoke', scope);
    expect((await page.reload())?.status()).toBe(403);
    await page.getByLabel('Ключ доступа').fill(key);
    await page.getByRole('button', { name: 'Открыть доступ' }).click();
    await expect(page.getByRole('heading', { name: 'Ключ не подошёл' })).toBeVisible();
  } finally {
    await plain.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    store.close();
  }
});

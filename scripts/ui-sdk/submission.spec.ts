import { expect, test, type Page } from '@playwright/test';
import { once } from 'node:events';
import { siteServer } from '../../server/site.mjs';
import { openAccessStore } from '../../server/access-store.mjs';
import { openSubmissions } from '../../server/submissions/store.mjs';
import { validateEditorial } from '../../server/submissions/editorial.mjs';

async function checkFormPalette(page: Page, reference: Page) {
  const initial = await page.locator('html').getAttribute('data-theme');
  for (const theme of ['light', 'dark']) {
    const colors = await reference.evaluate(theme => {
      document.documentElement.dataset.theme = theme;
      const sample = document.createElement('span');
      sample.style.cssText = 'background-color:var(--paper);color:var(--ink)';
      document.body.append(sample);
      const computed = getComputedStyle(sample);
      const colors = { paper: computed.backgroundColor, ink: computed.color, scheme: computed.colorScheme };
      sample.remove();
      return colors;
    }, theme);
    expect(colors.scheme).toBe(theme);
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    await expect(page.locator('.sheet')).toHaveCSS('background-color', colors.paper);
    await expect(page.locator('body')).toHaveCSS('color', colors.ink);
    await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
  }
  await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, initial!);
}

test('заявку подаёт автор, публикацию подтверждает только владелец', async ({ browser, page }) => {
  const access = openAccessStore(':memory:');
  const jobs = openSubmissions(':memory:');
  const origin = 'http://127.0.0.1:4199';
  const server = siteServer(access, origin, { store: jobs, enabled: true }).listen(4199, '127.0.0.1');
  await once(server, 'listening');
  const owner = await browser.newContext();
  const guest = await browser.newContext({ javaScriptEnabled: false });
  const errors: string[] = [];
  try {
    page.on('pageerror', error => errors.push(error.message));
    const reference = await owner.newPage();
    await reference.goto(origin + '/');
    await page.goto(origin + '/submit/');
    await checkFormPalette(page, reference);
    const theme = page.getByRole('button', { name: 'Тёмная тема' });
    const dark = await theme.getAttribute('aria-pressed') === 'true';
    await theme.press('Space');
    const expectedTheme = dark ? 'light' : 'dark';
    await expect(page.locator('html')).toHaveAttribute('data-theme', expectedTheme);
    await page.reload();
    await expect(theme).toHaveAttribute('aria-pressed', String(!dark));
    await page.locator('ui-input input[name=url]').fill('https://youtu.be/abcdefghijk');
    const send = page.getByRole('button', { name: 'Разобрать видео' });
    await expect(send).toBeDisabled();
    await page.locator('ui-checkbox[name=consent]').click();
    await page.getByRole('button', { name: 'Коллекция, название и доступ' }).click();
    await page.getByRole('button', { name: 'Создать коллекцию' }).click();
    await page.locator('#new_collection').fill('Тест прав');
    await page.locator('#new_access ui-select-trigger button').click();
    await page.locator('#new_access ui-select-item[value=key]').click();
    await page.locator('#collection_key').fill('guest123');
    await page.getByRole('button', { name: 'Изменить название, автора и оружие' }).click();
    const submittedFacets: Record<string, string[]> = {};
    for (const name of ['authors', 'weapons']) {
      const root = page.locator('ui-autocomplete[name=' + name + ']');
      const field = root.getByRole('combobox', { name: name === 'authors' ? 'Автор или преподаватель' : 'Оружие', exact: true });
      const suggestion = await root.evaluate(element => (element as HTMLElement & { items: string[] }).items[0]);
      await field.fill('Свободный ввод, ' + suggestion.toLowerCase());
      const option = page.getByRole('option', { name: suggestion, exact: true });
      await expect(option).toBeVisible();
      if (name === 'authors') {
        await field.press('ArrowDown');
        await field.press('Enter');
      } else {
        await option.click();
      }
      await expect(field).toHaveValue('Свободный ввод, ' + suggestion);
      submittedFacets[name] = ['Свободный ввод', suggestion];
    }
    await send.click();
    await page.waitForURL(/\/submit\/[0-9a-f]{32}$/);
    const path = new URL(page.url()).pathname;
    const id = path.split('/').pop()!;
    expect((await guest.request.get(origin + path)).status()).toBe(404);
    expect((await page.request.get(origin + '/admin/')).status()).toBe(403);
    expect((await page.request.post(origin + path + '/publish', { headers: { Origin: origin }, form: { reviewed: 'yes' } })).status()).toBe(403);

    const job = jobs.claim();
    expect(job.id).toBe(id);
    expect(jobs.get(id).placement).toMatchObject(submittedFacets);
    expect(jobs.get(id).placement.newAccess).toBe('key');
    const text = 'Синтетический контроль концентрации.';
    const source = { duration: 10, segments: [{ id: 0, start: 0, end: 10, text }] };
    const claim = { text, citations: [{ segment_id: 0, quote: text }], rationale: 'Exact synthetic source', checks: ['actor_action','conditions_negation','modality_scope','terms_numbers','context_causality'] };
    const editorial = validateEditorial({ format_version: 'archive-skill-v2', overview: [claim], chapters: [{ first: 0, last: 0, title: claim, summary: claim, points: [claim] }], materials: { notes: [{ title: claim, items: [claim] }], exercises: [], glossary: [] }, source_coverage: [{ first: 0, last: 0, disposition: 'summarized', reason: 'Whole source' }], terminology: [], limitations: [] }, source);
    jobs.finish(id, job.lease, { ...editorial, title: text, segments: source.segments, flags: [], review: { pass: true, issues: [], notes: 'Synthetic' } });

    await page.goto(origin + path);
    await page.locator('.pub-open').click();
    const frame = page.frameLocator('iframe[title="Параметры публикации"]');
    await expect(page.getByRole('dialog', { name: 'Публикация разбора' })).toBeVisible();
    await frame.getByRole('button', { name: 'Выбрать существующую' }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('.pub-open')).toBeFocused();
    await page.keyboard.press('Enter');
    await frame.getByRole('button', { name: 'Выбрать существующую' }).click();
    await frame.locator('#collection ui-select-trigger button').click();
    const collectionTitle = 'Лекции и семинары Овчинникова Александра';
    const group = frame.getByRole('group', { name: collectionTitle, exact: true });
    await group.getByRole('option', { name: /Тренерство, клуб и здоровье/ }).click();
    await frame.locator('#collection_key').fill('report12');
    await frame.getByRole('button', { name: 'Сохранить изменения' }).click();
    await expect(frame.getByRole('status')).toContainText('принята');
    expect(jobs.get(id).placement).toMatchObject({ collection: 'ovchinnikov-lectures', section: 1 });
    expect((await guest.request.get(origin + path + '/settings')).status()).toBe(404);

    const login = await owner.request.post(origin + '/api/login', { headers: { Origin: origin }, form: { key: access.issue('archive:owner'), target: 'hema-theory' } });
    expect(login.status()).toBe(204);
    const admin = await owner.newPage();
    admin.on('pageerror', error => errors.push(error.message));
    await admin.emulateMedia({ colorScheme: 'dark' });
    await admin.addInitScript(() => localStorage.setItem('theme', 'light'));
    await admin.goto(origin + '/admin/');
    await expect(admin.locator('html')).toHaveAttribute('data-theme', 'light');
    await checkFormPalette(admin, reference);
    await admin.locator('ui-input [data-access-search]').fill('несуществующий материал');
    await expect(admin.locator('[data-access-empty]')).toBeVisible();
    await admin.locator('[data-access-empty] button').click();
    const editor = admin.locator('.password-editor').first();
    await editor.locator('ui-collapsible-trigger button').click();
    await editor.locator('input[name=password]').fill('test123');
    await editor.getByRole('button', { name: 'Отмена' }).click();
    await expect(editor.locator('input[name=password]')).toBeHidden();
    await editor.locator('ui-collapsible-trigger button').click();
    await expect(editor.locator('input[name=password]')).toHaveValue('');
    await editor.locator('input[name=password]').fill('test456');
    await editor.getByRole('button', { name: 'Сохранить пароль' }).click();
    await expect(admin.locator('.row-notice')).toContainText('Пароль сохранён');
    await admin.goto(origin + path + '/settings');
    const publish = admin.getByRole('button', { name: 'Опубликовать' });
    await expect(publish).toBeDisabled();
    await admin.locator('ui-checkbox[name=reviewed]').click();
    await publish.click();
    await expect.poll(() => jobs.get(id).state).toBe('published');
    expect((await guest.request.get(origin + '/reports/' + jobs.get(id).publication.report.slug + '/')).status()).toBe(200);
    const slug = jobs.get(id).publication.report.slug;
    expect((await guest.request.get(origin + '/transcripts/' + slug + '.json')).status()).toBe(403);
    const grant = await guest.request.post(origin + '/api/login', { headers: { Origin: origin }, form: { key: 'report12', target: 'submission-report-' + id } });
    expect(grant.status()).toBe(204);
    expect((await guest.request.get(origin + '/transcripts/' + slug + '.json')).status()).toBe(200);
    const fallback = await guest.newPage();
    await fallback.goto(origin + '/submit/');
    await fallback.locator('input[name=url]').fill('https://youtu.be/Fallback123');
    await fallback.locator('input[name=consent]').check();
    await fallback.getByText('Коллекция, название и доступ', { exact: true }).click();
    const nativeGroup = fallback.locator('select[name=collection] optgroup').filter({
      has: fallback.locator('option[value="ovchinnikov-lectures:1"]')
    });
    await expect(nativeGroup).toHaveAttribute('label', collectionTitle);
    await fallback.locator('select[name=collection]').selectOption('ovchinnikov-lectures:1');
    await fallback.getByText('Изменить название, автора и оружие', { exact: true }).click();
    await fallback.locator('input[name=authors]').fill('Первый автор, Второй автор');
    await fallback.locator('input[name=weapons]').fill('Первый вид, Второй вид');
    await fallback.getByRole('button', { name: 'Разобрать видео' }).click();
    await fallback.waitForURL(/\/submit\/[0-9a-f]{32}$/);
    const otherId = new URL(fallback.url()).pathname.split('/').pop()!;
    expect(jobs.get(otherId).state).toBe('queued');
    expect(jobs.get(otherId).placement).toMatchObject({
      collection: 'ovchinnikov-lectures', section: 1,
      authors: ['Первый автор', 'Второй автор'], weapons: ['Первый вид', 'Второй вид']
    });
    expect((await owner.request.get(fallback.url())).status()).toBe(200);
    expect((await page.request.get(fallback.url())).status()).toBe(404);
    expect(errors).toEqual([]);
  } finally {
    await owner.close();
    await guest.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    access.close();
    jobs.close();
  }
});

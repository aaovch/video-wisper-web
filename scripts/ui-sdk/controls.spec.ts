import { test, expect } from '@playwright/test';

test('catalog search writes the full query and the selected view to the URL', async ({ page }) => {
	await page.goto('/');
	const input = page.getByRole('searchbox').first();
	await input.fill('биомеханика');
	await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('биомеханика');
	const chapters = page.getByRole('radio', { name: 'Главы' });
	await chapters.click();
	await expect(chapters).toBeChecked();
	await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('chapters');
	await input.fill('дистанция');
	const expand = page.locator('.show-all');
	await expand.click();
	await expect(expand).toHaveAttribute('aria-expanded', 'true');
	await expect.poll(() => new URL(page.url()).searchParams.get('results')).toBe('all');
	await expand.click();
	await expect(expand).toHaveAttribute('aria-expanded', 'false');
	await expect.poll(() => new URL(page.url()).searchParams.has('results')).toBe(false);
	const theme = page.getByRole('button', { name: 'Тёмная тема' });
	const before = await theme.getAttribute('aria-pressed');
	await theme.click();
	await expect(theme).toHaveAttribute('aria-pressed', String(before !== 'true'));
});

test('statistics period supports keyboard selection', async ({ page }) => {
	await page.goto('/stats/');
	const period = page.getByRole('combobox', { name: 'Период' });
	await period.click();
	await page.getByRole('option', { name: '7 дней' }).click();
	await expect(period).toContainText('7 дней');
	await period.press('Enter');
	await page.keyboard.press('Escape');
	await expect(period).toBeFocused();
});

test('recording disclosure, tabs and transcript dialog work with the keyboard', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Ввести ключ', exact: true }).click();
	const access = page.getByRole('dialog');
	await access.getByLabel('Ключ доступа', { exact: true }).fill('sdk-test');
	await access.getByRole('button', { name: 'Открыть доступ', exact: true }).click();
	await expect(page).toHaveURL(/\/collections\//);
	await page.goto('/reports/metodichka/');
	const opener = page.locator('.read-transcript').first();
	await opener.click();
	const reader = page.getByRole('dialog');
	await expect(reader).toBeVisible();
	await expect(reader.locator('.back')).toBeFocused();
	await page.setViewportSize({ width: 390, height: 844 });
	const toggle = reader.locator('.video-toggle');
	const player = reader.locator('.video-stage video');
	await expect(player).toBeVisible();
	const original = await player.elementHandle();
	await toggle.press('Space');
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(player).toBeHidden();
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(player).toBeVisible();
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(player).toBeHidden();
	await toggle.press('Enter');
	await expect(player).toBeVisible();
	expect(await player.evaluate((node, before) => node === before, original)).toBe(true);
	await page.keyboard.press('Escape');
	await expect(reader).toBeHidden();
	await expect(opener).toBeFocused();
	const disclosure = page.locator('.additional-summary');
	await disclosure.click();
	await expect(disclosure).toHaveAttribute('aria-expanded','true');
	const tabs = page.getByRole('tablist').last().getByRole('tab');
	await tabs.first().focus();
	if (await tabs.count() > 1) {
		await page.keyboard.press('End');
		await expect(tabs.last()).toBeFocused();
		await tabs.last().press('Enter');
	}
	await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('tabpanel').last()).toBeVisible();
});

test('настройка статистики повторяет загрузку и меняется после подтверждения сервера', async ({ page }) => {
	const endpoint = '**/api/statistics/preference*';
	await page.route(endpoint, route => route.fulfill({ status: 503 }), { times: 1 });
	await page.goto('/stats/');
	const settings = page.getByRole('button', { name: 'Правила и настройки учёта' });
	await settings.click();
	await page.getByRole('button', { name: 'Загрузить настройку' }).click();
	const toggle = page.getByRole('button', { name: 'Исключить мои посещения' });
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	await page.route(endpoint, route => route.fulfill({ status: 503 }), { times: 1 });
	await toggle.press('Space');
	await expect(page.getByRole('alert')).toContainText('Не удалось обновить настройку');
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	await toggle.press('Enter');
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('alert')).toHaveCount(0);
	await page.reload();
	await settings.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});


test('оболочка применяет системную тему до гидратации при недоступном хранилище', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.addInitScript(() => {
		Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } });
	});
	await page.route('**/_app/**/*.js', route => route.abort());
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.locator('html')).toHaveClass(/\bjs\b/);
});

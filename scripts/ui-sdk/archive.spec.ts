import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
	test.describe(`${viewport.width}px`, () => {
		test.use({ viewport });
		test('filters keep selection, dismiss and restore focus', async ({ page }, testInfo) => {
			const errors: string[] = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.goto('/');
			const trigger = page.locator('.category').first();
			await trigger.focus();
			await page.keyboard.press('Enter');
			const popup = page.locator('.filter-menu');
			await expect(popup).toBeVisible();
			await page.screenshot({ path: testInfo.outputPath('filters.png') });
			const bounds = await popup.boundingBox();
			expect(bounds!.x).toBeGreaterThanOrEqual(0);
			expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
			const checkbox = popup.getByRole('checkbox').first();
			await checkbox.focus();
			await page.keyboard.press('Space');
			await expect(checkbox).toBeChecked();
			await page.keyboard.press('Escape');
			await expect(popup).toBeHidden();
			await expect(trigger).toBeFocused();
			await page.keyboard.press('Enter');
			await expect(popup.getByRole('checkbox').first()).toBeChecked();
			await popup.getByRole('button', { name: 'Готово' }).click();
			await expect(popup).toBeHidden();
			await expect(trigger).toBeFocused();
			await trigger.click();
			await page.locator('h1').click();
			await expect(popup).toBeHidden();
			expect(errors).toEqual([]);
		});

		test('access dialog traps focus, reports failure and clears the key', async ({ page }, testInfo) => {
			await page.goto('/');
			const trigger = page.getByRole('button', { name: 'Ввести ключ', exact: true });
			await trigger.focus();
			await page.keyboard.press('Enter');
			const dialog = page.getByRole('dialog', { name: 'Открыть материалы' });
			await expect(dialog).toBeVisible();
			const closeBounds = await dialog.getByRole('button', { name: 'Закрыть', exact: true }).boundingBox();
			expect(closeBounds!.width).toBeGreaterThanOrEqual(44);
			expect(closeBounds!.height).toBeGreaterThanOrEqual(44);
			await page.screenshot({ path: testInfo.outputPath('access.png') });
			const input = dialog.getByLabel('Ключ доступа', { exact: true });
			await expect(input).toBeFocused();
			await input.fill('local-invalid-test-key');
			await dialog.getByRole('button', { name: 'Открыть доступ', exact: true }).click();
			await expect(dialog.getByText('Ключ не подошёл.', { exact: false })).toBeVisible();
			await expect(input).toHaveAttribute('aria-invalid', 'true');
			for (let i = 0; i < 8; i++) {
				await page.keyboard.press('Tab');
				expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
			}
			await page.keyboard.press('Escape');
			await expect(dialog).toBeHidden();
			await expect(trigger).toBeFocused();
			await page.keyboard.press('Enter');
			await expect(input).toHaveValue('');
			await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
			await expect(trigger).toBeFocused();
		});
	});
}

test('valid local key unlocks a collection through the server', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Ввести ключ', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Открыть материалы' });
	await dialog.getByLabel('Ключ доступа', { exact: true }).fill('sdk-test');
	await dialog.getByRole('button', { name: 'Открыть доступ', exact: true }).click();
	await expect(page).toHaveURL(/\/collections\//);
	expect((await page.request.get('/transcripts/metodichka.chapters.json')).status()).toBe(200);
});

test('filter search, switching groups, themes and contrast', async ({ page }, testInfo) => {
	await page.goto('/');
	const triggers = page.locator('.category');
	await expect(triggers.first()).toBeVisible();
	for (const theme of ['light', 'dark']) {
		await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
		let foundSearch = false;
		for (let i = 0; i < await triggers.count(); i++) {
			await triggers.nth(i).click();
			await expect(page.locator('.filter-menu')).toHaveCount(1);
			const search = page.getByRole('searchbox', { name: 'Найти в списке' });
			if (await search.count()) {
				await search.fill('zzzz-no-option');
				await expect(page.getByText('Совпадений нет', { exact: true })).toBeVisible();
				await search.fill('');
				foundSearch = true;
			}
		}
		expect(foundSearch).toBe(true);
		const contrast = await page.locator('.filter-menu').evaluate(el => {
			const rgb = (text: string) => text.match(/[\d.]+/g)!.slice(0, 3).map(Number);
			const luminance = (text: string) => rgb(text).map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
			const style = getComputedStyle(el);
			const a = luminance(style.color), b = luminance(style.backgroundColor);
			return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
		});
		expect(contrast).toBeGreaterThanOrEqual(4.5);
		await page.screenshot({ path: testInfo.outputPath(`${theme}-filters.png`) });
		await page.keyboard.press('Escape');
		await page.getByRole('button', { name: 'Ввести ключ', exact: true }).click();
		await page.screenshot({ path: testInfo.outputPath(`${theme}-access.png`) });
		await page.keyboard.press('Escape');
	}
});

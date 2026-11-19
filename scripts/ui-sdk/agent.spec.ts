import { expect, test } from '@playwright/test';

test('agent discovers controls, changes a filter and cannot read a key', async ({ page }) => {
	await page.goto('http://127.0.0.1:4198');
	await expect(page.getByRole('button', { name: 'Оружие', exact: true })).toBeVisible();
	const act = (steps: unknown[]) => page.evaluate(async (steps) => {
		return (window as any).uiSdkAgent.act({ steps });
	}, steps);
	const snapshot = () => page.evaluate(() => (window as any).uiSdkAgent.snapshot().filter((entry: any) => !entry.offPage));
	const initial = await snapshot();
	for (const entry of initial) expect(entry.label).toBeTruthy();
	expect(initial.map((entry: any) => entry.label)).toContain('Оружие');
	expect((await act([{ ref: 'Оружие', action: 'setOpen', args: [true] }])).ok).toBe(true);
	const opened = await snapshot();
	const checkbox = opened.find((entry: any) => entry.component === 'checkbox');
	expect(checkbox.label).toBeTruthy();
	expect((await act([{ ref: checkbox.label, action: 'setChecked', args: [true] }])).ok).toBe(true);
	await expect(page.getByLabel('Выбранное оружие')).toHaveText(checkbox.label);
	expect((await act([{ ref: 'Оружие', action: 'setOpen', args: [false] }])).ok).toBe(true);
	expect((await act([{ ref: 'Ввести ключ', action: 'press' }])).ok).toBe(true);
	await expect(page.getByRole('dialog', { name: 'Открыть материалы' })).toBeVisible();
	const result = await act([{ ref: 'Ключ доступа', action: 'setValue', args: ['secret-local-fixture'] }]);
	expect(result.ok).toBe(true);
	await expect(page.getByLabel('Ключ доступа', { exact: true })).toHaveValue('secret-local-fixture');
	expect(JSON.stringify(await snapshot())).not.toContain('secret-local-fixture');
	expect(JSON.stringify(result)).not.toContain('secret-local-fixture');
	for (const entry of await snapshot()) expect(entry.label).toBeTruthy();
});

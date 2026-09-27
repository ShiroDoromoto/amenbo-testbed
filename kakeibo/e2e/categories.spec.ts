import { expect, test } from '@playwright/test';

test('カテゴリを足し、名前を変える', async ({ page }) => {
  await page.goto('/#/categories');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'カテゴリ', exact: true })).toBeVisible();

  await main.getByRole('radio', { name: '収入' }).check();
  await main.getByLabel('新しいカテゴリの名前').fill('副業');
  await main.getByRole('button', { name: '追加する' }).click();
  const income = main.getByRole('region', { name: '収入' });
  await expect(income.getByRole('listitem').last()).toContainText('副業');

  await income.getByRole('button', { name: '副業の名前を変える' }).click();
  await income.getByLabel('副業の新しい名前').fill('内職');
  await income.getByRole('button', { name: '保存する' }).click();
  await expect(income.getByRole('listitem').last()).toContainText('内職');

  await page.reload();
  await expect(main.getByRole('region', { name: '収入' }).getByText('内職')).toBeVisible();
});

test('スマホ幅でも、名前を変えている行が横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/#/categories');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: '水道光熱費の名前を変える' }).click();
  await expect(main.getByLabel('水道光熱費の新しい名前')).toBeFocused();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

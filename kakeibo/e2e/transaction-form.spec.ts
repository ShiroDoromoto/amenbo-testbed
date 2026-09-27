import { expect, test } from '@playwright/test';

test('取引の入力画面に、フォームの欄と保存ボタンが出る', async ({ page }) => {
  await page.goto('/#/transactions/new');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: '取引の入力' })).toBeVisible();
  for (const label of ['日付', '金額（円）', 'カテゴリ', '口座', 'メモ']) {
    await expect(main.getByLabel(label)).toBeVisible();
  }
  await expect(main.getByRole('button', { name: '保存する' })).toBeVisible();
});

test('スマホ幅でも、フォームが横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/#/transactions/new');
  await expect(page.getByRole('button', { name: '保存する' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

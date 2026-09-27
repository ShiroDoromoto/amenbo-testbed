import { expect, test } from '@playwright/test';

test('トップ画面を開くと、ヘッダーとダッシュボードが出る', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '家計簿' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'メインメニュー' })).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('heading', { name: 'ダッシュボード' }),
  ).toBeVisible();
});

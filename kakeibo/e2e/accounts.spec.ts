import { expect, test } from '@playwright/test';

test('口座を追加し、一覧から開いて直す', async ({ page }) => {
  await page.goto('/#/accounts');
  const main = page.getByRole('main');
  await expect(main.getByText('口座はまだありません。')).toBeVisible();

  await main.getByRole('link', { name: '口座を追加する' }).click();
  await expect(main.getByRole('heading', { name: '口座の追加' })).toBeVisible();
  await main.getByLabel('名前').fill('銀行');
  await main.getByLabel('銀行口座').check();
  await main.getByLabel('初期残高（円）').fill('100000');
  await main.getByRole('button', { name: '保存する' }).click();

  await expect(main.getByRole('heading', { name: '口座', exact: true })).toBeVisible();
  const row = main.getByRole('link', { name: /銀行/ });
  await expect(row).toContainText('銀行口座');
  await expect(row).toContainText('100,000円');

  await row.click();
  await expect(main.getByRole('heading', { name: '口座の編集' })).toBeVisible();
  await main.getByLabel('名前').fill('ゆうちょ');
  await main.getByLabel('初期残高（円）').fill('-5000');
  await main.getByRole('button', { name: '保存する' }).click();
  await expect(main.getByRole('link', { name: /ゆうちょ/ })).toContainText('-5,000円');
});

test('カード口座の編集で、締め日と引き落とし日を選んで保存する', async ({ page }) => {
  await page.goto('/#/accounts/new');
  const main = page.getByRole('main');
  await main.getByLabel('名前').fill('カード');
  await main.getByLabel('クレジットカード').check();
  await main.getByRole('button', { name: '保存する' }).click();

  await main.getByRole('link', { name: /カード/ }).click();
  await expect(main.getByRole('heading', { name: '口座の編集' })).toBeVisible();
  await expect(main.getByLabel(/^締め日/)).toHaveValue('');
  await main.getByLabel(/^締め日/).selectOption('15');
  await main.getByLabel(/^引き落とし日/).selectOption('10');
  await main.getByRole('button', { name: '保存する' }).click();

  await main.getByRole('link', { name: /カード/ }).click();
  await expect(main.getByLabel(/^締め日/)).toHaveValue('15');
  await expect(main.getByLabel(/^引き落とし日/)).toHaveValue('10');
});

test('スマホ幅でも、口座の一覧と編集画面が横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/#/accounts/new');
  const main = page.getByRole('main');
  await main.getByLabel('名前').fill('とても長い口座の名前'.repeat(10));
  await main.getByLabel('クレジットカード').check();
  await main.getByLabel('初期残高（円）').fill('-1234567890');
  await main.getByRole('button', { name: '保存する' }).click();

  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  const row = main.getByRole('link', { name: /とても長い/ });
  await expect(row).toBeVisible();
  expect(await overflow()).toBe(0);

  await row.click();
  await expect(main.getByRole('heading', { name: '口座の編集' })).toBeVisible();
  expect(await overflow()).toBe(0);
});

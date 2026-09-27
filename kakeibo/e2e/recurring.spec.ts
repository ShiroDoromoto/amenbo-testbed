import { expect, test, type Page } from '@playwright/test';

/** アプリに DB を作らせてから、口座を2つ直に入れる。 */
async function seedAccounts(page: Page) {
  await page.goto('/#/recurring');
  await expect(page.getByRole('main').getByText('定期取引はまだありません。')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('kakeibo');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('accounts', 'readwrite');
          tx.objectStore('accounts').put({
            id: 'e2e-bank',
            name: '銀行',
            type: 'bank',
            initialBalance: 0,
          });
          tx.objectStore('accounts').put({
            id: 'e2e-cash',
            name: '現金',
            type: 'cash',
            initialBalance: 0,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

test('定期取引を追加し、一覧から開いて直し、停止する', async ({ page }) => {
  await seedAccounts(page);
  const main = page.getByRole('main');

  await main.getByRole('link', { name: '定期取引を追加する' }).click();
  await expect(main.getByRole('heading', { name: '定期取引の追加' })).toBeVisible();
  await main.getByLabel('振替').check();
  await main.getByLabel('毎月の日').selectOption('25');
  await main.getByLabel('金額（円）').fill('30000');
  await main.getByLabel('振替先の口座').selectOption({ label: '現金' });
  await main.getByRole('button', { name: '保存する' }).click();

  await expect(main.getByRole('heading', { name: '定期取引', exact: true })).toBeVisible();
  const row = main.getByRole('link', { name: /毎月25日/ });
  await expect(row).toContainText('銀行 → 現金');

  await row.click();
  await expect(main.getByRole('heading', { name: '定期取引の編集' })).toBeVisible();
  await main.getByLabel('金額（円）').fill('20000');
  await main.getByRole('button', { name: '保存する' }).click();
  await expect(main.getByRole('link', { name: /毎月25日/ })).toContainText('20,000円');

  await main.getByRole('link', { name: /毎月25日/ }).click();
  await main.getByRole('button', { name: 'この定期取引を停止する' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '停止する' }).click();
  await expect(main.getByText('定期取引はまだありません。')).toBeVisible();
});

test('スマホ幅でも、定期取引の一覧と編集画面が横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seedAccounts(page);
  const main = page.getByRole('main');
  await main.getByRole('link', { name: '定期取引を追加する' }).click();
  await main.getByLabel('金額（円）').fill('1234567');
  await main.getByLabel('カテゴリ').selectOption({ index: 1 });
  await main.getByLabel('メモ').fill('とても長いメモ'.repeat(10));
  await main.getByRole('button', { name: '保存する' }).click();

  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  await expect(main.getByRole('link', { name: /毎月/ })).toBeVisible();
  expect(await overflow()).toBe(0);

  await main.getByRole('link', { name: /毎月/ }).click();
  await expect(main.getByRole('button', { name: 'この定期取引を停止する' })).toBeVisible();
  expect(await overflow()).toBe(0);
});

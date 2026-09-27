import { expect, test, type Page } from '@playwright/test';

/** アプリに DB を作らせてから、口座と支出の取引を2件、直に入れる。 */
async function seedTransactions(page: Page): Promise<void> {
  await page.goto('/#/transactions/new');
  await expect(page.getByRole('main').getByLabel('カテゴリ')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('kakeibo');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['categories', 'accounts', 'transactions'], 'readwrite');
          const categories = tx.objectStore('categories').getAll();
          categories.onsuccess = () => {
            const category = (categories.result as { id: string; type: string }[]).find(
              (c) => c.type === 'expense',
            )!;
            tx.objectStore('accounts').put({
              id: 'e2e-cash',
              name: '現金',
              type: 'cash',
              initialBalance: 0,
            });
            const transactions = tx.objectStore('transactions');
            transactions.put({
              id: 'e2e-lunch',
              date: '2026-09-10',
              amount: 800,
              type: 'expense',
              categoryId: category.id,
              accountId: 'e2e-cash',
              memo: 'ランチ',
            });
            transactions.put({
              id: 'e2e-dinner',
              date: '2026-09-20',
              amount: 1234567,
              type: 'expense',
              categoryId: category.id,
              accountId: 'e2e-cash',
              memo: '長いメモ'.repeat(30),
            });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

test('取引の一覧に、取引が日付の新しい順に日ごとの小計つきで出る', async ({ page }) => {
  await seedTransactions(page);
  await page.goto('/#/transactions');
  const main = page.getByRole('main');
  await expect(main.getByRole('listitem')).toHaveCount(2);
  const days = main.getByRole('heading', { level: 3 });
  await expect(days).toHaveCount(2);
  await expect(days.nth(0)).toContainText('2026-09-20');
  await expect(days.nth(0)).toContainText('-1,234,567円');
  await expect(days.nth(1)).toContainText('2026-09-10');
  await expect(days.nth(1)).toContainText('-800円');
});

test('一覧の取引を押すと、その取引の編集画面が開く', async ({ page }) => {
  await seedTransactions(page);
  await page.goto('/#/transactions');
  await page
    .getByRole('main')
    .getByRole('link', { name: /ランチ/ })
    .click();
  await expect(page).toHaveURL(/#\/transactions\/e2e-lunch$/);
  await expect(page.getByRole('main').getByLabel('メモ')).toHaveValue('ランチ');
});

test('スマホ幅でも、取引の一覧が横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seedTransactions(page);
  await page.goto('/#/transactions');
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(2);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

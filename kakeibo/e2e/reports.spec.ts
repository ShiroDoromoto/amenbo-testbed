import { expect, test, type Page } from '@playwright/test';

/** 2025年の支出を、月ごとに大きな金額で入れる。 */
async function seedExpenses(page: Page) {
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
            for (let month = 1; month <= 12; month++) {
              tx.objectStore('transactions').put({
                id: `e2e-${month}`,
                date: `2025-${String(month).padStart(2, '0')}-15`,
                amount: 1234567,
                type: 'expense',
                categoryId: category.id,
                accountId: 'e2e-cash',
                memo: '',
              });
            }
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

test('スマホ幅でも、年間レポートの表は表の中だけで横にスクロールし、画面ははみ出さない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/#/reports?year=2025');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: '年間レポート' })).toBeVisible();
  await seedExpenses(page);
  await page.reload();

  const table = main.getByRole('table', { name: '2025年の支出（単位：円）' });
  await expect(table).toBeVisible();
  await expect(table.locator('tfoot .annual-report-total')).toHaveText('14,814,804');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  const scroll = main.getByRole('region', { name: '2025年の支出（単位：円）' });
  const scrolls = await scroll.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(scrolls).toBe(true);
});

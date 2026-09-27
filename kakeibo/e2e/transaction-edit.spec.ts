import { expect, test, type Page } from '@playwright/test';

/** アプリに DB を作らせてから、口座と取引を1件ずつ直に入れ、取引の id を返す。 */
async function seedTransaction(page: Page): Promise<string> {
  await page.goto('/#/transactions/new');
  await expect(page.getByRole('main').getByLabel('カテゴリ')).toBeVisible();
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
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
            tx.objectStore('transactions').put({
              id: 'e2e-lunch',
              date: '2026-09-10',
              amount: 800,
              type: 'expense',
              categoryId: category.id,
              accountId: 'e2e-cash',
              memo: 'ランチ',
            });
          };
          tx.oncomplete = () => {
            db.close();
            resolve('e2e-lunch');
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

test('取引の編集画面に、取引の値が入ったフォームが出る', async ({ page }) => {
  const id = await seedTransaction(page);
  await page.goto(`/#/transactions/${id}`);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: '取引の編集' })).toBeVisible();
  await expect(main.getByLabel('金額（円）')).toHaveValue('800');
  await expect(main.getByLabel('メモ')).toHaveValue('ランチ');
});

test('取引を直して保存すると、取引の一覧に戻る', async ({ page }) => {
  const id = await seedTransaction(page);
  await page.goto(`/#/transactions/${id}`);
  const main = page.getByRole('main');
  await main.getByLabel('金額（円）').fill('1200');
  await main.getByRole('button', { name: '保存する' }).click();
  await expect(page).toHaveURL(/#\/transactions$/);
  await expect(page.getByText('保存しました')).toBeVisible();

  await page.goto(`/#/transactions/${id}`);
  await expect(main.getByLabel('金額（円）')).toHaveValue('1200');
});

test('スマホ幅でも、編集画面が横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const id = await seedTransaction(page);
  await page.goto(`/#/transactions/${id}`);
  await expect(page.getByRole('button', { name: '保存する' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('無い取引の編集画面では、見つからない旨を出す', async ({ page }) => {
  await page.goto('/#/transactions/missing');
  await expect(page.getByRole('main').getByText('取引が見つかりません')).toBeVisible();
});

test('確認ダイアログで削除すると、取引が消えて取引の一覧に戻る', async ({ page }) => {
  const id = await seedTransaction(page);
  await page.goto(`/#/transactions/${id}`);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'この取引を削除する' }).click();
  const dialog = page.getByRole('alertdialog', { name: '取引を削除しますか？' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '削除する' }).click();
  await expect(page).toHaveURL(/#\/transactions$/);
  await expect(page.getByText('削除しました')).toBeVisible();

  await page.goto(`/#/transactions/${id}`);
  await expect(main.getByText('取引が見つかりません')).toBeVisible();
});

test('削除のあと「元に戻す」を押すと、取引が戻って編集画面に戻る', async ({ page }) => {
  const id = await seedTransaction(page);
  await page.goto(`/#/transactions/${id}`);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'この取引を削除する' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '削除する' }).click();
  await expect(page).toHaveURL(/#\/transactions$/);

  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page).toHaveURL(new RegExp(`#/transactions/${id}$`));
  await expect(page.getByText('元に戻しました')).toBeVisible();
  await expect(main.getByLabel('メモ')).toHaveValue('ランチ');
});

test('スマホ幅でも、「元に戻す」の付いたトーストが横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const id = await seedTransaction(page);
  await page.goto(`/#/transactions/${id}`);
  await page.getByRole('button', { name: 'この取引を削除する' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('button', { name: '元に戻す' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('スマホ幅でも、削除の確認ダイアログが横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const id = await seedTransaction(page);
  await page.goto(`/#/transactions/${id}`);
  await page.getByRole('button', { name: 'この取引を削除する' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

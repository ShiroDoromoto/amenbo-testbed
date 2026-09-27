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

test('色を選んでカテゴリを足し、色を変える', async ({ page }) => {
  await page.goto('/#/categories');
  const main = page.getByRole('main');
  await main.getByRole('radio', { name: '青', exact: true }).check();
  await main.getByLabel('新しいカテゴリの名前').fill('書籍');
  await main.getByRole('button', { name: '追加する' }).click();
  const expense = main.getByRole('region', { name: '支出' });
  const row = expense.getByRole('listitem').last();
  await expect(row).toContainText('書籍');
  await expect(row.locator('.category-swatch')).toHaveCSS('background-color', 'rgb(28, 126, 214)');

  await expense.getByRole('button', { name: '書籍の色を変える' }).click();
  await row.getByRole('radio', { name: '紫', exact: true }).check();
  await row.getByRole('button', { name: '保存する' }).click();
  await expect(row.locator('.category-swatch')).toHaveCSS('background-color', 'rgb(95, 61, 196)');

  await page.reload();
  await expect(
    main
      .getByRole('region', { name: '支出' })
      .getByRole('listitem')
      .last()
      .locator('.category-swatch'),
  ).toHaveCSS('background-color', 'rgb(95, 61, 196)');
});

test('スマホ幅でも、色を変えている行が横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/#/categories');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: '水道光熱費の色を変える' }).click();
  await expect(main.getByRole('group', { name: '水道光熱費の色' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('使われているカテゴリを、付け替え先を選んで消す', async ({ page }) => {
  await page.goto('/#/categories');
  const main = page.getByRole('main');
  const expense = main.getByRole('region', { name: '支出' });
  await expect(expense.getByText('食費')).toBeVisible();

  // 食費を使う取引を1件、DB に直に入れる。
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('kakeibo');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['categories', 'transactions'], 'readwrite');
          const categories = tx.objectStore('categories').getAll();
          categories.onsuccess = () => {
            const food = (categories.result as { id: string; name: string }[]).find(
              (c) => c.name === '食費',
            )!;
            tx.objectStore('transactions').put({
              id: 'e2e-lunch',
              date: '2026-09-10',
              amount: 800,
              type: 'expense',
              categoryId: food.id,
              accountId: 'e2e-cash',
              memo: 'ランチ',
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

  await expense.getByRole('button', { name: '食費を削除する' }).click();
  const dialog = page.getByRole('alertdialog', { name: '「食費」を削除しますか？' });
  await expect(dialog).toContainText('取引 1 件');
  await dialog.getByLabel('付け替え先').selectOption({ label: '日用品' });
  await dialog.getByRole('button', { name: '削除する' }).click();
  await expect(expense.getByText('食費')).toHaveCount(0);

  // 付け替えた取引は、編集画面で日用品として出る。
  await page.goto('/#/transactions/e2e-lunch');
  await expect(main.getByLabel('カテゴリ').locator('option:checked')).toHaveText('日用品');
});

test('スマホ幅でも、カテゴリの行と削除の確認が横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/#/categories');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: '水道光熱費を削除する' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

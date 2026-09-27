import { expect, test, type Page } from '@playwright/test';

// 入れる取引は 2026年9月のもの。一覧は今日の月を出すので、今日を 2026年9月に決める。
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-28T12:00:00'));
});

/**
 * アプリに DB を作らせてから、口座と支出の取引を2件、直に入れる。
 * `extra` を渡すと、2026-09-01 の支出の取引をその件数だけ足す。
 */
async function seedTransactions(page: Page, extra = 0): Promise<void> {
  await page.goto('/#/transactions/new');
  await expect(page.getByRole('main').getByLabel('カテゴリ')).toBeVisible();
  await page.evaluate(
    (extra) =>
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
            for (let i = 0; i < extra; i++) {
              transactions.put({
                id: `e2e-extra-${i}`,
                date: '2026-09-01',
                amount: 100,
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
    extra,
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

test('前月・翌月のボタンで、表示する月を切り替える', async ({ page }) => {
  await seedTransactions(page);
  await page.goto('/#/transactions');
  const main = page.getByRole('main');
  const month = main.getByRole('navigation', { name: '表示する月' });
  await expect(month).toContainText('2026年9月');
  await expect(main.getByRole('listitem')).toHaveCount(2);

  await month.getByRole('button', { name: '前月' }).click();
  await expect(month).toContainText('2026年8月');
  await expect(main.getByText('2026年8月の取引はありません')).toBeVisible();
  await expect(main.getByRole('listitem')).toHaveCount(0);

  await month.getByRole('button', { name: '翌月' }).click();
  await expect(month).toContainText('2026年9月');
  await expect(main.getByRole('listitem')).toHaveCount(2);
});

test('口座を選ぶと、その口座の取引だけに絞り込む', async ({ page }) => {
  await seedTransactions(page);
  await page.goto('/#/transactions');
  const main = page.getByRole('main');
  await expect(main.getByRole('listitem')).toHaveCount(2);

  await main.getByLabel('口座').selectOption({ label: '現金' });
  await expect(main.getByRole('listitem')).toHaveCount(2);

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
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await main.getByLabel('口座').selectOption({ label: '銀行' });
  await expect(main.getByText('2026年9月の銀行の取引はありません')).toBeVisible();
  await expect(main.getByRole('listitem')).toHaveCount(0);

  await main.getByLabel('口座').selectOption({ label: 'すべての口座' });
  await expect(main.getByRole('listitem')).toHaveCount(2);
});

test('カテゴリを選ぶと、そのカテゴリの取引だけが出る', async ({ page }) => {
  await seedTransactions(page);
  await page.goto('/#/transactions');
  const main = page.getByRole('main');
  await expect(main.getByRole('listitem')).toHaveCount(2);
  const filter = main.getByLabel('カテゴリ');

  const other = await filter.locator('optgroup[label="収入"] option').first().textContent();
  await filter.selectOption({ label: other! });
  await expect(main.getByText(`2026年9月の「${other}」の取引はありません`)).toBeVisible();
  await expect(main.getByRole('listitem')).toHaveCount(0);

  await filter.selectOption({ label: 'すべて' });
  await expect(main.getByRole('listitem')).toHaveCount(2);
});

test('収支区分を選ぶと、その区分の取引だけが出る', async ({ page }) => {
  await seedTransactions(page);
  await page.goto('/#/transactions');
  const main = page.getByRole('main');
  await expect(main.getByRole('listitem')).toHaveCount(2);
  const filter = main.getByLabel('収支区分');

  await filter.selectOption({ label: '収入' });
  await expect(main.getByText('2026年9月の「収入」の取引はありません')).toBeVisible();
  await expect(main.getByRole('listitem')).toHaveCount(0);

  await filter.selectOption({ label: '支出' });
  await expect(main.getByRole('listitem')).toHaveCount(2);
});

test('月と絞り込みの条件は URL に残り、再読み込みしても保つ', async ({ page }) => {
  await seedTransactions(page);
  await page.goto('/#/transactions');
  const main = page.getByRole('main');
  await expect(main.getByRole('listitem')).toHaveCount(2);

  await main.getByLabel('メモ').fill('ランチ');
  await main.getByLabel('金額の上限').fill('1000');
  await expect(main.getByRole('listitem')).toHaveCount(1);
  await main.getByRole('button', { name: '前月' }).click();
  await expect(page).toHaveURL(/#\/transactions\?month=2026-08&/);

  await page.reload();
  await expect(main.getByRole('navigation', { name: '表示する月' })).toContainText('2026年8月');
  await expect(main.getByLabel('メモ')).toHaveValue('ランチ');
  await expect(main.getByLabel('金額の上限')).toHaveValue('1000');
  await main.getByRole('button', { name: '翌月' }).click();
  await expect(main.getByRole('listitem')).toHaveCount(1);
  await expect(main.getByRole('listitem')).toContainText('ランチ');
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

test('並び順を選ぶと、金額や日付の順に並べ替わる', async ({ page }) => {
  await seedTransactions(page);
  await page.goto('/#/transactions');
  const main = page.getByRole('main');
  const links = main.getByRole('link', { name: /ランチ|長いメモ/ });
  await expect(links).toHaveCount(2);
  await expect(links.first()).toHaveAttribute('href', '#/transactions/e2e-dinner');

  await main.getByLabel('並び順').selectOption({ label: '日付の古い順' });
  await expect(links.first()).toHaveAttribute('href', '#/transactions/e2e-lunch');

  await main.getByLabel('並び順').selectOption({ label: '金額の小さい順' });
  await expect(links.first()).toHaveAttribute('href', '#/transactions/e2e-lunch');
  await expect(links.first()).toContainText('2026-09-10');

  await main.getByLabel('並び順').selectOption({ label: '金額の大きい順' });
  await expect(links.first()).toHaveAttribute('href', '#/transactions/e2e-dinner');
});

test('スマホ幅でも、取引の一覧と月の切り替え、口座・収支区分・カテゴリの絞り込み、メモの検索、金額の範囲、並び順が横にはみ出さない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seedTransactions(page);
  await page.goto('/#/transactions');
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '翌月' })).toBeInViewport();
  await expect(page.getByRole('main').getByLabel('口座')).toBeInViewport();
  await expect(page.getByRole('main').getByLabel('収支区分')).toBeInViewport();
  await expect(page.getByRole('main').getByLabel('カテゴリ')).toBeInViewport();
  await expect(page.getByRole('main').getByLabel('メモ')).toBeInViewport();
  await expect(page.getByRole('main').getByLabel('金額の下限')).toBeInViewport();
  await expect(page.getByRole('main').getByLabel('金額の上限')).toBeInViewport();
  await expect(page.getByRole('main').getByLabel('並び順')).toBeInViewport();
  await page.getByRole('main').getByLabel('並び順').selectOption({ label: '金額の大きい順' });
  await expect(page.getByRole('main').locator('.transaction-list-date')).toHaveCount(2);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('取引が50件を超えたら、スマホ幅でもページ送りが横にはみ出さずに出る', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seedTransactions(page, 60);
  await page.goto('/#/transactions');
  const main = page.getByRole('main');
  const pager = main.getByRole('navigation', { name: 'ページ送り' });
  await expect(main.locator('.transaction-list').getByRole('listitem')).toHaveCount(50);
  await expect(pager).toContainText('1 / 2ページ（62件中 1〜50件目）');

  await pager.getByRole('button', { name: '次へ' }).click();
  await expect(main.locator('.transaction-list').getByRole('listitem')).toHaveCount(12);
  await expect(pager).toContainText('2 / 2ページ（62件中 51〜62件目）');
  await expect(pager.getByRole('button', { name: '次へ' })).toBeDisabled();
  await pager.scrollIntoViewIfNeeded();
  await expect(pager.getByRole('button', { name: '前へ' })).toBeInViewport();
  await expect(pager.getByRole('button', { name: '次へ' })).toBeInViewport();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { ToastProvider } from '../../components/Toast/index.ts';
import type { RecurringTransaction } from '../../domain/recurring.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { addAccount } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import {
  addRecurringTransaction,
  getRecurringTransaction,
} from '../../db/repositories/recurring.ts';
import { EditRecurringPage, replaceRecurring } from './EditRecurringPage.tsx';

const testDbName = 'kakeibo-edit-recurring-page-test';

afterEach(async () => {
  render(null, document.body);
  document.body.innerHTML = '';
  window.location.hash = '';
  await deleteDB(testDbName);
});

async function waitFor<T>(
  find: () => T | null | undefined | Promise<T | null | undefined>,
): Promise<T> {
  for (let i = 0; i < 100; i++) {
    const found = await find();
    if (found) return found;
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  throw new Error('待っても出てこなかった');
}

/** 口座を2つと、支出の定期取引を1件入れる。 */
async function setup() {
  const db = await openKakeiboDB(testDbName);
  const cash = await addAccount(db, { name: '現金', type: 'cash', initialBalance: 0 });
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const categories = await listCategories(db);
  const expense = categories.filter((c) => c.type === 'expense');
  const recurring = await addRecurringTransaction(db, {
    dayOfMonth: 27,
    amount: 80000,
    type: 'expense',
    categoryId: expense[0]!.id,
    accountId: bank.id,
    memo: '家賃',
  });
  db.close();
  return { cash, bank, expense, recurring };
}

function renderPage(id: string) {
  render(
    <ToastProvider>
      <EditRecurringPage id={id} dbName={testDbName} />
    </ToastProvider>,
    document.body,
  );
}

function button(name: string) {
  return [...document.querySelectorAll('button')].find((b) => b.textContent === name);
}

test('定期取引の値をフォームに入れて出す', async () => {
  const { bank, expense, recurring } = await setup();
  renderPage(recurring.id);
  const form = await waitFor(() => document.querySelector('form'));
  const value = (name: string) =>
    form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!.value;

  expect(document.querySelector('h2')?.textContent).toBe('定期取引の編集');
  expect(value('dayOfMonth')).toBe('27');
  expect(value('amount')).toBe('80000');
  expect(form.querySelector<HTMLInputElement>('[name="type"]:checked')?.value).toBe('expense');
  expect(value('categoryId')).toBe(expense[0]!.id);
  expect(value('accountId')).toBe(bank.id);
  expect(value('memo')).toBe('家賃');
});

test('直した内容で定期取引を置き換え、定期取引の一覧に戻る', async () => {
  const { cash, recurring } = await setup();
  renderPage(recurring.id);
  const form = await waitFor(() => document.querySelector('form'));
  const field = <T extends HTMLElement>(name: string) => form.querySelector<T>(`[name="${name}"]`)!;

  await act(() => {
    const transfer = form.querySelector<HTMLInputElement>('[name="type"][value="transfer"]')!;
    transfer.click();
  });
  await act(() => {
    const day = field<HTMLSelectElement>('dayOfMonth');
    day.value = '31';
    day.dispatchEvent(new Event('change', { bubbles: true }));
    const to = field<HTMLSelectElement>('toAccountId');
    to.value = cash.id;
    to.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  await waitFor(() => window.location.hash === '#/recurring');
  const check = await openKakeiboDB(testDbName);
  const saved = await getRecurringTransaction(check, recurring.id);
  check.close();
  expect(saved).toEqual({
    id: recurring.id,
    dayOfMonth: 31,
    amount: 80000,
    type: 'transfer',
    accountId: recurring.accountId,
    toAccountId: cash.id,
    memo: '家賃',
  });
  expect(document.body.textContent).toContain('保存しました');
});

test('id の定期取引が無ければ、見つからない旨を出す', async () => {
  await setup();
  renderPage('missing');
  await waitFor(() =>
    [...document.querySelectorAll('p')].find((p) =>
      p.textContent?.startsWith('定期取引が見つかりません'),
    ),
  );
  expect(document.querySelector('form')).toBeNull();
});

test('停止を押すと確認ダイアログを出し、キャンセルなら消さない', async () => {
  const { recurring } = await setup();
  renderPage(recurring.id);
  const open = await waitFor(() => button('この定期取引を停止する'));
  await act(() => open.click());

  const dialog = document.querySelector('[role="alertdialog"]');
  expect(dialog?.textContent).toContain('定期取引を停止しますか？');
  await act(() => button('キャンセル')!.click());
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();

  const check = await openKakeiboDB(testDbName);
  expect(await getRecurringTransaction(check, recurring.id)).toBeDefined();
  check.close();
  expect(window.location.hash).toBe('');
});

test('確認ダイアログで停止すると、定期取引を消して定期取引の一覧に戻る', async () => {
  const { recurring } = await setup();
  renderPage(recurring.id);
  const open = await waitFor(() => button('この定期取引を停止する'));
  await act(() => open.click());
  await act(() => button('停止する')!.click());

  await waitFor(() => window.location.hash === '#/recurring');
  const check = await openKakeiboDB(testDbName);
  expect(await getRecurringTransaction(check, recurring.id)).toBeUndefined();
  check.close();
  expect(document.body.textContent).toContain('停止しました');
});

test('replaceRecurring は、区分に合わない欄を落とし、フォームで扱わない欄を残す', () => {
  const current = {
    id: 'r1',
    dayOfMonth: 25,
    amount: 30000,
    type: 'transfer',
    accountId: 'bank',
    toAccountId: 'cash',
    memo: '',
    extra: 'kept',
  } as RecurringTransaction;
  expect(
    replaceRecurring(current, {
      dayOfMonth: 10,
      amount: 5000,
      type: 'expense',
      categoryId: 'food',
      accountId: 'cash',
      memo: '食費',
    }),
  ).toEqual({
    id: 'r1',
    dayOfMonth: 10,
    amount: 5000,
    type: 'expense',
    categoryId: 'food',
    accountId: 'cash',
    memo: '食費',
    extra: 'kept',
  });
});

import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { ToastProvider } from '../../components/Toast/index.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { addAccount, getAccount } from '../../db/repositories/accounts.ts';
import { EditAccountPage } from './EditAccountPage.tsx';

const testDbName = 'kakeibo-edit-account-page-test';

afterEach(async () => {
  render(null, document.body);
  document.body.innerHTML = '';
  window.location.hash = '';
  await deleteDB(testDbName);
});

async function waitFor<T>(find: () => T | null | undefined): Promise<T> {
  for (let i = 0; i < 100; i++) {
    const found = find();
    if (found) return found;
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  throw new Error('待っても出てこなかった');
}

async function setup() {
  const db = await openKakeiboDB(testDbName);
  const account = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 100000 });
  db.close();
  return account;
}

function renderPage(id: string) {
  render(
    <ToastProvider>
      <EditAccountPage id={id} dbName={testDbName} />
    </ToastProvider>,
    document.body,
  );
}

test('口座の値をフォームに入れて出す', async () => {
  const account = await setup();
  renderPage(account.id);
  const form = await waitFor(() => document.querySelector('form'));
  const value = (name: string) => form.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value;

  expect(document.querySelector('h2')?.textContent).toBe('口座の編集');
  expect(value('name')).toBe('銀行');
  expect(form.querySelector<HTMLInputElement>('[name="type"]:checked')?.value).toBe('bank');
  expect(value('initialBalance')).toBe('100000');
});

test('直した内容で口座を置き換え、口座の一覧に戻る', async () => {
  const account = await setup();
  renderPage(account.id);
  const form = await waitFor(() => document.querySelector('form'));

  await act(() => {
    const name = form.querySelector<HTMLInputElement>('[name="name"]')!;
    name.value = 'ゆうちょ銀行';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const balance = form.querySelector<HTMLInputElement>('[name="initialBalance"]')!;
    balance.value = '50,000';
    balance.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  await waitFor(() => window.location.hash === '#/accounts');
  const check = await openKakeiboDB(testDbName);
  const saved = await getAccount(check, account.id);
  check.close();
  expect(saved).toEqual({
    id: account.id,
    name: 'ゆうちょ銀行',
    type: 'bank',
    initialBalance: 50000,
    closingDay: null,
    paymentDay: null,
  });
  expect(document.body.textContent).toContain('保存しました');
});

test('id の口座が無ければ、見つからない旨を出す', async () => {
  await setup();
  renderPage('missing');
  await waitFor(() =>
    [...document.querySelectorAll('p')].find((p) => p.textContent === '口座が見つかりません。'),
  );
  expect(document.querySelector('form')).toBeNull();
});

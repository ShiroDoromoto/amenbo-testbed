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

async function setupCard() {
  const db = await openKakeiboDB(testDbName);
  const account = await addAccount(db, {
    name: 'カード',
    type: 'card',
    initialBalance: 0,
    closingDay: 15,
    paymentDay: null,
  });
  db.close();
  return account;
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

async function savedAccount(id: string) {
  await waitFor(() => window.location.hash === '#/accounts');
  const check = await openKakeiboDB(testDbName);
  const saved = await getAccount(check, id);
  check.close();
  return saved;
}

test('カード以外の口座では、締め日と引き落とし日の欄を出さない', async () => {
  const account = await setup();
  renderPage(account.id);
  const form = await waitFor(() => document.querySelector('form'));
  expect(form.querySelector('[name="closingDay"]')).toBeNull();
  expect(form.querySelector('[name="paymentDay"]')).toBeNull();
});

test('カードの締め日と引き落とし日を出し、直した日で保存する', async () => {
  const account = await setupCard();
  renderPage(account.id);
  const form = await waitFor(() => document.querySelector('form'));
  const select = (name: string) => form.querySelector<HTMLSelectElement>(`[name="${name}"]`)!;
  expect(select('closingDay').value).toBe('15');
  expect(select('paymentDay').value).toBe('');

  await act(() => {
    select('closingDay').value = '31';
    select('closingDay').dispatchEvent(new Event('change', { bubbles: true }));
    select('paymentDay').value = '27';
    select('paymentDay').dispatchEvent(new Event('change', { bubbles: true }));
  });
  await submit(form);

  expect(await savedAccount(account.id)).toMatchObject({ closingDay: 31, paymentDay: 27 });
});

test('カードの締め日と引き落とし日は、決めていないに戻せる', async () => {
  const account = await setupCard();
  renderPage(account.id);
  const form = await waitFor(() => document.querySelector('form'));

  await act(() => {
    const closing = form.querySelector<HTMLSelectElement>('[name="closingDay"]')!;
    closing.value = '';
    closing.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await submit(form);

  expect(await savedAccount(account.id)).toMatchObject({ closingDay: null, paymentDay: null });
});

test('カードから別の種類に変えると、締め日と引き落とし日を消す', async () => {
  const account = await setupCard();
  renderPage(account.id);
  const form = await waitFor(() => document.querySelector('form'));

  await act(() => {
    form.querySelector<HTMLInputElement>('[name="type"][value="bank"]')!.click();
  });
  expect(form.querySelector('[name="closingDay"]')).toBeNull();
  await submit(form);

  expect(await savedAccount(account.id)).toMatchObject({
    type: 'bank',
    closingDay: null,
    paymentDay: null,
  });
});

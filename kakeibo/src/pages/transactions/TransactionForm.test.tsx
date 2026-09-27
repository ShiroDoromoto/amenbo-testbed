import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast/index.ts';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import { TransactionForm } from './TransactionForm.tsx';

const categories: Category[] = [
  { id: 'food', name: '食費', type: 'expense', color: '#ff0000', order: 0 },
  { id: 'salary', name: '給与', type: 'income', color: '#00ff00', order: 1 },
];

const accounts: Account[] = [
  { id: 'cash', name: '現金', type: 'cash', initialBalance: 0, closingDay: null, paymentDay: null },
  { id: 'bank', name: '銀行', type: 'bank', initialBalance: 0, closingDay: null, paymentDay: null },
];

afterEach(() => {
  render(null, document.body.firstElementChild!);
  document.body.innerHTML = '';
  localStorage.clear();
});

function renderForm(
  onSubmit = vi.fn(),
  accountList: Account[] = accounts,
  rememberSelection = false,
  memoSuggestions?: string[],
) {
  const root = document.createElement('div');
  document.body.append(root);
  render(
    <ToastProvider>
      <TransactionForm
        categories={categories}
        accounts={accountList}
        defaults={{ date: '2026-09-28' }}
        rememberSelection={rememberSelection}
        memoSuggestions={memoSuggestions}
        onSubmit={onSubmit}
      />
    </ToastProvider>,
    root,
  );
  const form = root.querySelector('form')!;
  const field = <T extends HTMLElement>(name: string) => form.querySelector<T>(`[name="${name}"]`)!;
  return { root, form, field, onSubmit };
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function choose(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

test('日付・収支・金額・カテゴリ・口座・メモの欄を出す', () => {
  const { field } = renderForm();
  expect(field<HTMLInputElement>('date').value).toBe('2026-09-28');
  expect(field<HTMLInputElement>('type').value).toBe('expense');
  for (const name of ['amount', 'categoryId', 'accountId', 'memo']) {
    expect(field(name)).not.toBeNull();
  }
});

function optionLabels(select: HTMLSelectElement) {
  return [...select.options].map((o) => o.textContent);
}

test('選んだ収支区分のカテゴリと、口座を選択肢に出す', () => {
  const { field } = renderForm();
  expect(optionLabels(field('categoryId'))).toEqual(['選んでください', '食費']);
  expect(optionLabels(field('accountId'))).toEqual(['現金', '銀行']);
});

test('収支区分を切り替えると、カテゴリの選択肢も切り替わり、選び直しになる', async () => {
  const { form, field } = renderForm();
  await act(() => choose(field('categoryId'), 'food'));
  await act(() => form.querySelector<HTMLInputElement>('input[value="income"]')!.click());
  expect(optionLabels(field('categoryId'))).toEqual(['選んでください', '給与']);
  expect(field<HTMLSelectElement>('categoryId').value).toBe('');

  await act(() => form.querySelector<HTMLInputElement>('input[value="expense"]')!.click());
  expect(optionLabels(field('categoryId'))).toEqual(['選んでください', '食費']);
  expect(field<HTMLSelectElement>('categoryId').value).toBe('');
});

test('収支区分を切り替えたあと、前の区分のカテゴリのままでは渡さない', async () => {
  const { form, field, onSubmit } = renderForm();
  await act(() => {
    type(field('amount'), '500');
    choose(field('categoryId'), 'food');
  });
  await act(() => form.querySelector<HTMLInputElement>('input[value="income"]')!.click());
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
});

test('入力した内容を取引にして渡す', async () => {
  const { form, field, onSubmit } = renderForm();
  // 収入のカテゴリは、収支区分を収入にしてから選択肢に出る。
  await act(() => form.querySelector<HTMLInputElement>('input[value="income"]')!.click());
  await act(() => {
    type(field('date'), '2026-09-01');
    type(field('amount'), '１,２３４円');
    choose(field('categoryId'), 'salary');
    choose(field('accountId'), 'bank');
    type(field('memo'), ' 9月分 ');
  });
  await submit(form);
  expect(onSubmit).toHaveBeenCalledWith({
    date: '2026-09-01',
    amount: 1234,
    type: 'income',
    categoryId: 'salary',
    accountId: 'bank',
    memo: '9月分',
  });
});

test('金額が読めないときは渡さない', async () => {
  const { form, field, onSubmit } = renderForm();
  await act(() => {
    type(field('amount'), 'abc');
    choose(field('categoryId'), 'food');
  });
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
});

test.each(['0', '-500'])('金額が %s 円のときは渡さない', async (amount) => {
  const { form, field, onSubmit } = renderForm();
  await act(() => {
    type(field('amount'), amount);
    choose(field('categoryId'), 'food');
  });
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
});

test('口座が無いときは渡さない', async () => {
  const { form, field, onSubmit } = renderForm(vi.fn(), []);
  expect(field<HTMLSelectElement>('accountId').required).toBe(true);
  await act(() => {
    type(field('amount'), '500');
    choose(field('categoryId'), 'food');
  });
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
});

function errorOf(form: HTMLFormElement, name: string): string | null {
  const control = form.querySelector(`[name="${name}"]`)!;
  const errorId = control.getAttribute('aria-describedby');
  return errorId ? (document.getElementById(errorId)?.textContent ?? null) : null;
}

test('何も入れずに保存すると、金額とカテゴリにエラーを出し、金額の欄に移る', async () => {
  const { form, field, onSubmit } = renderForm();
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(errorOf(form, 'amount')).toBe('金額を入れてください');
  expect(errorOf(form, 'categoryId')).toBe('カテゴリを選んでください');
  expect(errorOf(form, 'date')).toBeNull();
  expect(errorOf(form, 'accountId')).toBeNull();
  expect(field('amount').getAttribute('aria-invalid')).toBe('true');
  expect(field('date').hasAttribute('aria-invalid')).toBe(false);
  expect(document.activeElement).toBe(field('amount'));
});

test('日付を消して保存すると、日付にエラーを出す', async () => {
  const { form, field, onSubmit } = renderForm();
  await act(() => {
    type(field('date'), '');
    type(field('amount'), '500');
    choose(field('categoryId'), 'food');
  });
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(errorOf(form, 'date')).toBe('日付を入れてください');
  expect(document.activeElement).toBe(field('date'));
});

test('金額が正でなければ、そのことをエラーで出す', async () => {
  const { form, field } = renderForm();
  await act(() => {
    type(field('amount'), '0');
    choose(field('categoryId'), 'food');
  });
  await submit(form);
  expect(errorOf(form, 'amount')).toBe('金額は1円以上にしてください');
});

test('エラーを出したあと、欄を直すとその欄のエラーが消える', async () => {
  const { form, field } = renderForm();
  await submit(form);
  await act(() => {
    type(field('amount'), '500');
  });
  expect(errorOf(form, 'amount')).toBeNull();
  expect(errorOf(form, 'categoryId')).toBe('カテゴリを選んでください');
  await act(() => {
    choose(field('categoryId'), 'food');
  });
  expect(errorOf(form, 'categoryId')).toBeNull();
});

test('保存を押すまでは、エラーを出さない', async () => {
  const { form, field } = renderForm();
  await act(() => {
    type(field('amount'), 'abc');
  });
  expect(form.querySelector('.transaction-form-error')).toBeNull();
});

async function fillValid(form: HTMLFormElement, field: <T extends HTMLElement>(name: string) => T) {
  // 収支を変えるとカテゴリの選択肢が描き直されるので、先に切り替えておく。
  await act(() => {
    form.querySelector<HTMLInputElement>('input[value="income"]')!.click();
  });
  await act(() => {
    type(field('date'), '2026-09-01');
    type(field('amount'), '500');
    choose(field('categoryId'), 'salary');
    choose(field('accountId'), 'bank');
    type(field('memo'), '9月分');
  });
}

test('保存できたら、フォームを初めの状態に戻し、トーストで知らせる', async () => {
  const { form, field, onSubmit } = renderForm();
  await fillValid(form, field);
  await submit(form);
  expect(onSubmit).toHaveBeenCalledOnce();
  expect(field<HTMLInputElement>('date').value).toBe('2026-09-28');
  expect(form.querySelector<HTMLInputElement>('input[value="expense"]')!.checked).toBe(true);
  expect(field<HTMLInputElement>('amount').value).toBe('');
  expect(field<HTMLSelectElement>('categoryId').value).toBe('');
  expect(field<HTMLSelectElement>('accountId').value).toBe('cash');
  expect(field<HTMLInputElement>('memo').value).toBe('');
  expect(form.querySelector('.transaction-form-error')).toBeNull();
  expect(document.querySelector('[role="status"]')?.textContent).toContain('保存しました');
});

test('保存できなかったら、入力を残し、エラーのトーストを出す', async () => {
  const onSubmit = vi.fn().mockRejectedValue(new Error('書けない'));
  const { form, field } = renderForm(onSubmit);
  await fillValid(form, field);
  await submit(form);
  expect(field<HTMLInputElement>('amount').value).toBe('500');
  expect(field<HTMLInputElement>('memo').value).toBe('9月分');
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('保存できませんでした');
  expect(document.querySelector('[role="status"]')).toBeNull();
});

function labelOf(form: HTMLFormElement, name: string): string | null {
  const control = form.querySelector(`[name="${name}"]`)!;
  return form.querySelector(`label[for="${control.id}"]`)?.textContent ?? null;
}

async function chooseTransfer(form: HTMLFormElement) {
  await act(() => form.querySelector<HTMLInputElement>('input[value="transfer"]')!.click());
}

test('振替を選ぶと、カテゴリの欄を隠し、振替元と振替先の口座を出す', async () => {
  const { form, field } = renderForm();
  expect(field('toAccountId')).toBeNull();
  await chooseTransfer(form);
  expect(field('categoryId')).toBeNull();
  expect(labelOf(form, 'accountId')).toBe('振替元の口座');
  expect(labelOf(form, 'toAccountId')).toBe('振替先の口座');
  expect(optionLabels(field('toAccountId'))).toEqual(['選んでください', '現金', '銀行']);

  await act(() => form.querySelector<HTMLInputElement>('input[value="expense"]')!.click());
  expect(field('toAccountId')).toBeNull();
  expect(labelOf(form, 'accountId')).toBe('口座');
});

test('振替を入力すると、カテゴリを持たない振替の取引にして渡す', async () => {
  const { form, field, onSubmit } = renderForm();
  await act(() => choose(field('categoryId'), 'food'));
  await chooseTransfer(form);
  await act(() => {
    type(field('amount'), '30000');
    choose(field('accountId'), 'bank');
    choose(field('toAccountId'), 'cash');
    type(field('memo'), '引き出し');
  });
  await submit(form);
  expect(onSubmit).toHaveBeenCalledWith({
    date: '2026-09-28',
    amount: 30000,
    type: 'transfer',
    accountId: 'bank',
    toAccountId: 'cash',
    memo: '引き出し',
  });
});

test('振替先を選ばずに保存すると、振替先にエラーを出し、その欄に移る', async () => {
  const { form, field, onSubmit } = renderForm();
  await chooseTransfer(form);
  await act(() => type(field('amount'), '30000'));
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(errorOf(form, 'toAccountId')).toBe('振替先の口座を選んでください');
  expect(document.activeElement).toBe(field('toAccountId'));
});

test('振替先が振替元と同じ口座なら、渡さずにエラーを出す', async () => {
  const { form, field, onSubmit } = renderForm();
  await chooseTransfer(form);
  await act(() => {
    type(field('amount'), '30000');
    choose(field('toAccountId'), 'cash');
  });
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(errorOf(form, 'toAccountId')).toBe('振替元と別の口座を選んでください');
});

test('振替を初期値に渡すと、振替の欄にその値を入れて出す', () => {
  const root = document.createElement('div');
  document.body.append(root);
  render(
    <ToastProvider>
      <TransactionForm
        categories={categories}
        accounts={accounts}
        defaults={{
          date: '2026-09-11',
          type: 'transfer',
          amount: 30000,
          accountId: 'bank',
          toAccountId: 'cash',
        }}
        onSubmit={vi.fn()}
      />
    </ToastProvider>,
    root,
  );
  const form = root.querySelector('form')!;
  expect(form.querySelector<HTMLInputElement>('[name="type"]:checked')?.value).toBe('transfer');
  expect(form.querySelector<HTMLSelectElement>('[name="accountId"]')!.value).toBe('bank');
  expect(form.querySelector<HTMLSelectElement>('[name="toAccountId"]')!.value).toBe('cash');
});

test('過去のメモを、メモの欄の候補に出す', () => {
  const { form, field } = renderForm(vi.fn(), accounts, false, ['コンビニ', 'ランチ']);
  const memo = field<HTMLInputElement>('memo');
  const list = memo.list!;
  expect(list).not.toBeNull();
  expect(form.contains(list)).toBe(true);
  expect([...list.querySelectorAll('option')].map((o) => o.value)).toEqual(['コンビニ', 'ランチ']);
});

test('過去のメモが無ければ、候補を出さない', () => {
  const { form, field } = renderForm();
  expect(field<HTMLInputElement>('memo').hasAttribute('list')).toBe(false);
  expect(form.querySelector('datalist')).toBeNull();
});

test('前回保存したカテゴリと口座を、次の入力の初期値にする', async () => {
  const first = renderForm(vi.fn(), accounts, true);
  await act(() => {
    type(first.field('amount'), '500');
    choose(first.field('categoryId'), 'food');
    choose(first.field('accountId'), 'bank');
  });
  await submit(first.form);
  // 保存したあとに戻したフォームでも、選んだものが残る。
  expect(first.field<HTMLSelectElement>('categoryId').value).toBe('food');
  expect(first.field<HTMLSelectElement>('accountId').value).toBe('bank');
  expect(first.field<HTMLInputElement>('amount').value).toBe('');

  render(null, document.body.firstElementChild!);
  document.body.innerHTML = '';
  const second = renderForm(vi.fn(), accounts, true);
  expect(second.field<HTMLSelectElement>('categoryId').value).toBe('food');
  expect(second.field<HTMLSelectElement>('accountId').value).toBe('bank');
});

test('収支区分を切り替えると、その区分で前回選んだカテゴリにする', async () => {
  const { form, field } = renderForm(vi.fn(), accounts, true);
  await act(() => form.querySelector<HTMLInputElement>('input[value="income"]')!.click());
  await act(() => {
    type(field('amount'), '1000');
    choose(field('categoryId'), 'salary');
  });
  await submit(form);

  await act(() => form.querySelector<HTMLInputElement>('input[value="income"]')!.click());
  expect(field<HTMLSelectElement>('categoryId').value).toBe('salary');
  // 支出ではまだ選んだことが無いので、選び直しになる。
  await act(() => form.querySelector<HTMLInputElement>('input[value="expense"]')!.click());
  expect(field<HTMLSelectElement>('categoryId').value).toBe('');
});

test('前回選んだカテゴリや口座が消えていたら、初期値にしない', () => {
  localStorage.setItem(
    'kakeibo:lastSelection',
    JSON.stringify({ categoryIds: { expense: 'gone' }, accountId: 'gone' }),
  );
  const { field } = renderForm(vi.fn(), accounts, true);
  expect(field<HTMLSelectElement>('categoryId').value).toBe('');
  expect(field<HTMLSelectElement>('accountId').value).toBe('cash');
});

test('覚える指定が無ければ、前回の選択を使わない', async () => {
  const first = renderForm(vi.fn(), accounts, true);
  await act(() => {
    type(first.field('amount'), '500');
    choose(first.field('categoryId'), 'food');
    choose(first.field('accountId'), 'bank');
  });
  await submit(first.form);

  render(null, document.body.firstElementChild!);
  document.body.innerHTML = '';
  const { field } = renderForm();
  expect(field<HTMLSelectElement>('categoryId').value).toBe('');
  expect(field<HTMLSelectElement>('accountId').value).toBe('cash');
});

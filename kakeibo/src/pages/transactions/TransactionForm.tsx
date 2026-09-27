import { useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import type { IncomeExpenseType } from '../../domain/transaction.ts';
import type { NewTransaction } from '../../db/repositories/transactions.ts';
import { parseYen } from '../../lib/money.ts';
import './transactionForm.css';

const typeLabels: Record<IncomeExpenseType, string> = {
  expense: '支出',
  income: '収入',
};

type Props = {
  categories: readonly Category[];
  accounts: readonly Account[];
  /** 日付の初期値。`YYYY-MM-DD` 形式。 */
  initialDate: string;
  onSubmit: (transaction: NewTransaction) => void | Promise<void>;
};

/** 取引を1件入力するフォーム。保存は `onSubmit` に任せる。 */
export function TransactionForm({ categories, accounts, initialDate, onSubmit }: Props) {
  const [date, setDate] = useState(initialDate);
  const [type, setType] = useState<IncomeExpenseType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const typeCategories = categories.filter((c) => c.type === type);

  function changeType(value: IncomeExpenseType) {
    setType(value);
    // カテゴリはどちらか一方の収支区分に属するので、区分を変えたら選び直してもらう。
    setCategoryId('');
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    const yen = parseYen(amount);
    // 金額が読めないか正でないとき、カテゴリか口座が空のときは保存しない。
    // エラーの表示は入力チェックで足す。
    if (yen === null || yen <= 0 || !categoryId || !accountId || saving) return;
    setSaving(true);
    try {
      await onSubmit({ date, amount: yen, type, categoryId, accountId, memo: memo.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form class="transaction-form" onSubmit={handleSubmit}>
      <fieldset class="transaction-form-type">
        <legend>収支</legend>
        {(Object.keys(typeLabels) as IncomeExpenseType[]).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="type"
              value={value}
              checked={type === value}
              onChange={() => changeType(value)}
            />
            {typeLabels[value]}
          </label>
        ))}
      </fieldset>

      <label class="transaction-form-field">
        日付
        <input
          type="date"
          name="date"
          required
          value={date}
          onInput={(e) => setDate(e.currentTarget.value)}
        />
      </label>

      <label class="transaction-form-field">
        金額（円）
        <input
          type="text"
          name="amount"
          inputMode="numeric"
          autoComplete="off"
          required
          value={amount}
          onInput={(e) => setAmount(e.currentTarget.value)}
        />
      </label>

      <label class="transaction-form-field">
        カテゴリ
        <select
          name="categoryId"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.currentTarget.value)}
        >
          <option value="">選んでください</option>
          {typeCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label class="transaction-form-field">
        口座
        <select
          name="accountId"
          required
          value={accountId}
          onChange={(e) => setAccountId(e.currentTarget.value)}
        >
          {accounts.length === 0 && <option value="">口座がありません</option>}
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <label class="transaction-form-field">
        メモ
        <input
          type="text"
          name="memo"
          value={memo}
          onInput={(e) => setMemo(e.currentTarget.value)}
        />
      </label>

      <button class="transaction-form-submit" type="submit" disabled={saving}>
        保存する
      </button>
    </form>
  );
}

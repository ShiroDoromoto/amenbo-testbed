import type { ComponentChildren } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import type { IncomeExpenseType } from '../../domain/transaction.ts';
import type { NewTransaction } from '../../db/repositories/transactions.ts';
import {
  validateTransactionInput,
  type TransactionInput,
  type TransactionInputErrors,
  type TransactionInputField,
} from './validateTransactionInput.ts';
import './transactionForm.css';

const typeLabels: Record<IncomeExpenseType, string> = {
  expense: '支出',
  income: '収入',
};

/** 画面に並ぶ順。保存できなかったとき、この順で最初にエラーのある欄に移る。 */
const fieldOrder: readonly TransactionInputField[] = ['date', 'amount', 'categoryId', 'accountId'];

type Props = {
  categories: readonly Category[];
  accounts: readonly Account[];
  /** 日付の初期値。`YYYY-MM-DD` 形式。 */
  initialDate: string;
  onSubmit: (transaction: NewTransaction) => void | Promise<void>;
};

/** 取引を1件入力するフォーム。入力を確かめ、通ったものだけを `onSubmit` に渡す。 */
export function TransactionForm({ categories, accounts, initialDate, onSubmit }: Props) {
  const [input, setInput] = useState<TransactionInput>({
    date: initialDate,
    amount: '',
    categoryId: '',
    accountId: accounts[0]?.id ?? '',
  });
  const [type, setType] = useState<IncomeExpenseType>('expense');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  // 保存を押すまではエラーを出さない。押したあとは入力を変えるたびに確かめ直し、直した欄のエラーを消す。
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const typeCategories = categories.filter((c) => c.type === type);

  const validation = validateTransactionInput(input);
  const errors: TransactionInputErrors = submitted && !validation.ok ? validation.errors : {};

  function update(field: TransactionInputField, value: string) {
    setInput((prev) => ({ ...prev, [field]: value }));
  }

  function changeType(value: IncomeExpenseType) {
    setType(value);
    // カテゴリはどちらか一方の収支区分に属するので、区分を変えたら選び直してもらう。
    update('categoryId', '');
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (!validation.ok) {
      const first = fieldOrder.find((field) => validation.errors[field] !== undefined);
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...validation.value, type, memo: memo.trim() });
    } finally {
      setSaving(false);
    }
  }

  /** 入力欄に付ける属性。エラーがあれば、読み上げでもエラーが伝わるようにする。 */
  function controlProps(field: TransactionInputField) {
    const invalid = errors[field] !== undefined;
    return {
      id: `${id}-${field}`,
      name: field,
      required: true,
      'aria-invalid': invalid || undefined,
      'aria-describedby': invalid ? `${id}-${field}-error` : undefined,
    };
  }

  /** ラベル・入力欄・エラーメッセージを1つの欄にまとめる。 */
  function field(name: TransactionInputField, label: string, control: ComponentChildren) {
    return (
      <div class="transaction-form-field">
        <label for={`${id}-${name}`}>{label}</label>
        {control}
        {errors[name] !== undefined && (
          <p class="transaction-form-error" id={`${id}-${name}-error`}>
            {errors[name]}
          </p>
        )}
      </div>
    );
  }

  return (
    // 必須や形式の確かめはブラウザに任せず、自前のメッセージで出す。
    <form class="transaction-form" ref={formRef} noValidate onSubmit={handleSubmit}>
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

      {field(
        'date',
        '日付',
        <input
          {...controlProps('date')}
          type="date"
          value={input.date}
          onInput={(e) => update('date', e.currentTarget.value)}
        />,
      )}

      {field(
        'amount',
        '金額（円）',
        <input
          {...controlProps('amount')}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={input.amount}
          onInput={(e) => update('amount', e.currentTarget.value)}
        />,
      )}

      {field(
        'categoryId',
        'カテゴリ',
        <select
          {...controlProps('categoryId')}
          value={input.categoryId}
          onChange={(e) => update('categoryId', e.currentTarget.value)}
        >
          <option value="">選んでください</option>
          {typeCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>,
      )}

      {field(
        'accountId',
        '口座',
        <select
          {...controlProps('accountId')}
          value={input.accountId}
          onChange={(e) => update('accountId', e.currentTarget.value)}
        >
          {accounts.length === 0 && <option value="">口座がありません</option>}
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>,
      )}

      <div class="transaction-form-field">
        <label for={`${id}-memo`}>メモ</label>
        <input
          id={`${id}-memo`}
          type="text"
          name="memo"
          value={memo}
          onInput={(e) => setMemo(e.currentTarget.value)}
        />
      </div>

      <button class="transaction-form-submit" type="submit" disabled={saving}>
        保存する
      </button>
    </form>
  );
}

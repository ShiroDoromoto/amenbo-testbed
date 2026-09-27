import type { ComponentChildren } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';
import { useToast } from '../../components/Toast/index.ts';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import type { TransactionType } from '../../domain/transaction.ts';
import type { NewRecurringTransaction } from '../../db/repositories/recurring.ts';
import {
  validateRecurringInput,
  type RecurringInput,
  type RecurringInputErrors,
  type RecurringInputField,
} from './validateRecurringInput.ts';
// 見た目は取引の入力フォームに揃える。
import '../transactions/transactionForm.css';

const typeLabels: Record<TransactionType, string> = {
  expense: '支出',
  income: '収入',
  transfer: '振替',
};

const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

/** 画面に並ぶ順。保存できなかったとき、この順で最初にエラーのある欄に移る。 */
const fieldOrder: readonly RecurringInputField[] = [
  'dayOfMonth',
  'amount',
  'categoryId',
  'accountId',
  'toAccountId',
];

/** 欄の初期値。定期取引を編集するときは、その定期取引の値を渡す。 */
export type RecurringFormDefaults = {
  dayOfMonth: number;
  /** 省略すると支出。 */
  type?: TransactionType;
  amount?: number;
  categoryId?: string;
  /** 振替では振替元の口座。省略すると、口座の先頭。 */
  accountId?: string;
  /** 振替先の口座。 */
  toAccountId?: string;
  memo?: string;
};

type Props = {
  categories: readonly Category[];
  accounts: readonly Account[];
  defaults: RecurringFormDefaults;
  onSubmit: (recurring: NewRecurringTransaction) => void | Promise<void>;
};

/**
 * 定期取引を1件入力するフォーム。収入・支出と振替を扱う。入力を確かめ、通ったものだけを `onSubmit` に渡す。
 * 保存できたあとの動きは、呼ぶ側が `onSubmit` の中で決める。保存できなければ、トーストで知らせる。
 * `ToastProvider` の中で使う。
 */
export function RecurringForm({ categories, accounts, defaults, onSubmit }: Props) {
  const [input, setInput] = useState<RecurringInput>(() => ({
    dayOfMonth: String(defaults.dayOfMonth),
    amount: defaults.amount === undefined ? '' : String(defaults.amount),
    categoryId: defaults.categoryId ?? '',
    accountId: defaults.accountId ?? accounts[0]?.id ?? '',
    toAccountId: defaults.toAccountId ?? '',
  }));
  const [type, setType] = useState<TransactionType>(defaults.type ?? 'expense');
  const [memo, setMemo] = useState(defaults.memo ?? '');
  const [saving, setSaving] = useState(false);
  // 保存を押すまではエラーを出さない。押したあとは入力を変えるたびに確かめ直し、直した欄のエラーを消す。
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const toast = useToast();
  const typeCategories = categories.filter((c) => c.type === type);

  const transfer = type === 'transfer';
  const validation = validateRecurringInput(input, type);
  const errors: RecurringInputErrors = submitted && !validation.ok ? validation.errors : {};

  function update(field: RecurringInputField, value: string) {
    setInput((prev) => ({ ...prev, [field]: value }));
  }

  function changeType(value: TransactionType) {
    setType(value);
    // カテゴリはどちらか一方の収支区分に属するので、区分を変えたら選び直してもらう。振替はカテゴリを持たない。
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
      await onSubmit({ ...validation.value, memo: memo.trim() });
    } catch {
      // 入力は残し、直すか押し直せるようにする。
      toast.show('保存できませんでした', { kind: 'error' });
    } finally {
      setSaving(false);
    }
  }

  /** 入力欄に付ける属性。エラーがあれば、読み上げでもエラーが伝わるようにする。 */
  function controlProps(field: RecurringInputField) {
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
  function field(name: RecurringInputField, label: string, control: ComponentChildren) {
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

  const accountOptions = accounts.map((a) => (
    <option key={a.id} value={a.id}>
      {a.name}
    </option>
  ));

  return (
    // 必須や形式の確かめはブラウザに任せず、自前のメッセージで出す。
    <form class="transaction-form" ref={formRef} noValidate onSubmit={handleSubmit}>
      <fieldset class="transaction-form-type">
        <legend>区分</legend>
        {(Object.keys(typeLabels) as TransactionType[]).map((value) => (
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
        'dayOfMonth',
        '毎月の日（その日が無い月は月末）',
        <select
          {...controlProps('dayOfMonth')}
          value={input.dayOfMonth}
          onChange={(e) => update('dayOfMonth', e.currentTarget.value)}
        >
          {days.map((day) => (
            <option key={day} value={day}>
              {day}日
            </option>
          ))}
        </select>,
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

      {!transfer &&
        field(
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
        transfer ? '振替元の口座' : '口座',
        <select
          {...controlProps('accountId')}
          value={input.accountId}
          onChange={(e) => update('accountId', e.currentTarget.value)}
        >
          {accounts.length === 0 && <option value="">口座がありません</option>}
          {accountOptions}
        </select>,
      )}

      {transfer &&
        field(
          'toAccountId',
          '振替先の口座',
          <select
            {...controlProps('toAccountId')}
            value={input.toAccountId}
            onChange={(e) => update('toAccountId', e.currentTarget.value)}
          >
            <option value="">選んでください</option>
            {accountOptions}
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

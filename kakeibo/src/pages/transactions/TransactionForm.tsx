import type { ComponentChildren } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';
import { useToast } from '../../components/Toast/index.ts';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import type { TransactionType } from '../../domain/transaction.ts';
import type { NewTransaction } from '../../db/repositories/transactions.ts';
import { loadLastSelection, saveLastSelection } from './lastSelection.ts';
import {
  validateTransactionInput,
  type TransactionInput,
  type TransactionInputErrors,
  type TransactionInputField,
} from './validateTransactionInput.ts';
import './transactionForm.css';

const typeLabels: Record<TransactionType, string> = {
  expense: '支出',
  income: '収入',
  transfer: '振替',
};

/** 画面に並ぶ順。保存できなかったとき、この順で最初にエラーのある欄に移る。 */
const fieldOrder: readonly TransactionInputField[] = [
  'date',
  'amount',
  'categoryId',
  'accountId',
  'toAccountId',
];

/** 欄の初期値。取引を編集するときは、その取引の値を渡す。 */
export type TransactionFormDefaults = {
  /** `YYYY-MM-DD` 形式。 */
  date: string;
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
  defaults: TransactionFormDefaults;
  /**
   * 前回保存した取引のカテゴリと口座を覚えておき、`defaults` で決まっていない欄の初期値にする。
   * 新しく取引を入力するときに使う。
   */
  rememberSelection?: boolean;
  onSubmit: (transaction: NewTransaction) => void | Promise<void>;
};

/**
 * 取引を1件入力するフォーム。収入・支出と振替を扱う。入力を確かめ、通ったものだけを `onSubmit` に渡す。
 * 保存できたらフォームを `defaults` の状態に戻し、トーストで知らせる。
 * `ToastProvider` の中で使う。
 */
export function TransactionForm({
  categories,
  accounts,
  defaults,
  rememberSelection = false,
  onSubmit,
}: Props) {
  const initialType = defaults.type ?? 'expense';
  const initialMemo = defaults.memo ?? '';
  const [input, setInput] = useState<TransactionInput>(initialInput);
  const [type, setType] = useState<TransactionType>(initialType);
  const [memo, setMemo] = useState(initialMemo);
  const [saving, setSaving] = useState(false);
  // 保存を押すまではエラーを出さない。押したあとは入力を変えるたびに確かめ直し、直した欄のエラーを消す。
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const toast = useToast();
  const typeCategories = categories.filter((c) => c.type === type);

  const transfer = type === 'transfer';
  const validation = validateTransactionInput(input, type);
  const errors: TransactionInputErrors = submitted && !validation.ok ? validation.errors : {};

  /** 前回選んだカテゴリのうち、いまも在って `type` に属するもの。覚えていなければ空文字。 */
  function rememberedCategoryId(type: TransactionType): string {
    if (!rememberSelection || type === 'transfer') return '';
    const remembered = loadLastSelection().categoryIds[type];
    return categories.some((c) => c.id === remembered && c.type === type) ? remembered! : '';
  }

  /** 前回選んだ口座のうち、いまも在るもの。 */
  function rememberedAccountId(): string | undefined {
    if (!rememberSelection) return undefined;
    const remembered = loadLastSelection().accountId;
    return accounts.some((a) => a.id === remembered) ? remembered : undefined;
  }

  function initialInput(): TransactionInput {
    return {
      date: defaults.date,
      amount: defaults.amount === undefined ? '' : String(defaults.amount),
      categoryId: defaults.categoryId ?? rememberedCategoryId(initialType),
      accountId: defaults.accountId ?? rememberedAccountId() ?? accounts[0]?.id ?? '',
      toAccountId: defaults.toAccountId ?? '',
    };
  }

  function update(field: TransactionInputField, value: string) {
    setInput((prev) => ({ ...prev, [field]: value }));
  }

  function changeType(value: TransactionType) {
    setType(value);
    // カテゴリはどちらか一方の収支区分に属するので、区分を変えたら選び直してもらう。
    // 覚えていれば、その区分で前回選んだカテゴリにする。振替はカテゴリを持たない。
    update('categoryId', rememberedCategoryId(value));
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
    const transaction: NewTransaction = { ...validation.value, memo: memo.trim() };
    try {
      await onSubmit(transaction);
    } catch {
      // 入力は残し、直すか押し直せるようにする。
      toast.show('保存できませんでした', { kind: 'error' });
      return;
    } finally {
      setSaving(false);
    }
    if (rememberSelection) saveLastSelection(transaction);
    reset();
    toast.show('保存しました', { kind: 'success' });
  }

  function reset() {
    setInput(initialInput());
    setType(initialType);
    setMemo(initialMemo);
    setSubmitted(false);
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

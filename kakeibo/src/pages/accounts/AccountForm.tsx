import type { ComponentChildren } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';
import { useToast } from '../../components/Toast/index.ts';
import { accountTypes, type AccountType } from '../../domain/account.ts';
import type { NewAccount } from '../../db/repositories/accounts.ts';
import { accountTypeLabels } from './accountTypeLabels.ts';
import {
  validateAccountInput,
  type AccountInput,
  type AccountInputErrors,
  type AccountInputField,
} from './validateAccountInput.ts';
// 見た目は取引の入力フォームに揃える。
import '../transactions/transactionForm.css';

/** 画面に並ぶ順。保存できなかったとき、この順で最初にエラーのある欄に移る。 */
const fieldOrder: readonly AccountInputField[] = [
  'name',
  'type',
  'initialBalance',
  'closingDay',
  'paymentDay',
];

const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

/** 欄の初期値。口座を編集するときは、その口座の値を渡す。省略すると、空の現金の口座。 */
export type AccountFormDefaults = {
  name?: string;
  type?: AccountType;
  initialBalance?: number;
  closingDay?: number | null;
  paymentDay?: number | null;
};

type Props = {
  defaults?: AccountFormDefaults;
  onSubmit: (account: NewAccount) => void | Promise<void>;
};

/**
 * 口座を1件入力するフォーム。入力を確かめ、通ったものだけを `onSubmit` に渡す。
 * 保存できたあとの動きは、呼ぶ側が `onSubmit` の中で決める。保存できなければ、トーストで知らせる。
 * `ToastProvider` の中で使う。
 */
export function AccountForm({ defaults = {}, onSubmit }: Props) {
  const [input, setInput] = useState<AccountInput>(() => ({
    name: defaults.name ?? '',
    type: defaults.type ?? 'cash',
    initialBalance: defaults.initialBalance === undefined ? '0' : String(defaults.initialBalance),
    closingDay: defaults.closingDay == null ? '' : String(defaults.closingDay),
    paymentDay: defaults.paymentDay == null ? '' : String(defaults.paymentDay),
  }));
  const [saving, setSaving] = useState(false);
  // 保存を押すまではエラーを出さない。押したあとは入力を変えるたびに確かめ直し、直した欄のエラーを消す。
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const toast = useToast();

  const validation = validateAccountInput(input);
  const errors: AccountInputErrors = submitted && !validation.ok ? validation.errors : {};

  function update(field: AccountInputField, value: string) {
    setInput((prev) => ({ ...prev, [field]: value }));
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
      await onSubmit(validation.value);
    } catch {
      // 入力は残し、直すか押し直せるようにする。
      toast.show('保存できませんでした', { kind: 'error' });
    } finally {
      setSaving(false);
    }
  }

  /** 入力欄に付ける属性。エラーがあれば、読み上げでもエラーが伝わるようにする。 */
  function controlProps(field: AccountInputField) {
    const invalid = errors[field] !== undefined;
    return {
      id: `${id}-${field}`,
      name: field,
      'aria-invalid': invalid || undefined,
      'aria-describedby': invalid ? `${id}-${field}-error` : undefined,
    };
  }

  function error(name: AccountInputField) {
    return (
      errors[name] !== undefined && (
        <p class="transaction-form-error" id={`${id}-${name}-error`}>
          {errors[name]}
        </p>
      )
    );
  }

  /** ラベル・入力欄・エラーメッセージを1つの欄にまとめる。 */
  function field(name: AccountInputField, label: string, control: ComponentChildren) {
    return (
      <div class="transaction-form-field">
        <label for={`${id}-${name}`}>{label}</label>
        {control}
        {error(name)}
      </div>
    );
  }

  /** 締め日・引き落とし日の欄。決めていないことも選べる。 */
  function billingDayField(name: 'closingDay' | 'paymentDay', label: string) {
    return field(
      name,
      label,
      <select
        {...controlProps(name)}
        value={input[name]}
        onChange={(e) => update(name, e.currentTarget.value)}
      >
        <option value="">決めていない</option>
        {days.map((day) => (
          <option key={day} value={day}>
            {day}日
          </option>
        ))}
      </select>,
    );
  }

  return (
    // 必須や形式の確かめはブラウザに任せず、自前のメッセージで出す。
    <form class="transaction-form" ref={formRef} noValidate onSubmit={handleSubmit}>
      {field(
        'name',
        '名前',
        <input
          {...controlProps('name')}
          required
          type="text"
          autoComplete="off"
          value={input.name}
          onInput={(e) => update('name', e.currentTarget.value)}
        />,
      )}

      <fieldset class="transaction-form-type">
        <legend>種類</legend>
        {accountTypes.map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="type"
              value={value}
              checked={input.type === value}
              onChange={() => update('type', value)}
            />
            {accountTypeLabels[value]}
          </label>
        ))}
      </fieldset>
      {error('type')}

      {field(
        'initialBalance',
        '初期残高（円）',
        // 負の値も入れられるよう、`inputMode="numeric"` は付けない。スマホで数字だけのキーボードになり、`-` を打てない。
        <input
          {...controlProps('initialBalance')}
          required
          type="text"
          autoComplete="off"
          value={input.initialBalance}
          onInput={(e) => update('initialBalance', e.currentTarget.value)}
        />,
      )}

      {input.type === 'card' && (
        <>
          {billingDayField('closingDay', '締め日（その日が無い月は月末）')}
          {billingDayField('paymentDay', '引き落とし日（その日が無い月は月末）')}
        </>
      )}

      <button class="transaction-form-submit" type="submit" disabled={saving}>
        保存する
      </button>
    </form>
  );
}

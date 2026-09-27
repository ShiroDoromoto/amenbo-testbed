import { useEffect, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import { isTransfer, type Transaction } from '../../domain/transaction.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { listAccounts } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { listTransactionsByDateRange } from '../../db/repositories/transactions.ts';
import {
  addMonths,
  endOfMonth,
  startOfMonth,
  toDateString,
  type DateString,
} from '../../lib/date.ts';
import { formatYen, type Yen } from '../../lib/money.ts';
import { hashFromPath } from '../../router/index.ts';
import { filterTransactionsByAccount } from './filterTransactionsByAccount.ts';
import { filterTransactionsByMemo } from './filterTransactionsByMemo.ts';
import { groupTransactionsByDate, type TransactionDay } from './groupTransactionsByDate.ts';
import './transactionList.css';

type Loaded = {
  /** どの月を読んだか。月を切り替えた直後に、前の月の取引を出さないために持つ。 */
  month: DateString;
  transactions: Transaction[];
  /** 並び順に並べたカテゴリ。絞り込みの選択肢に出す。 */
  categories: Category[];
  categoryNames: ReadonlyMap<string, string>;
  /** 絞り込みの選択肢に出す口座。名前順。 */
  accounts: Account[];
  accountNames: ReadonlyMap<string, string>;
};

type Props = {
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
  /** 今日の日付。最初に今日の月を出す。テストで日付を決めるときに渡す。 */
  today?: DateString;
};

// カテゴリや口座が消されていても、一覧は出す。
const missingName = '（削除済み）';

function namesById(items: readonly (Category | Account)[]): ReadonlyMap<string, string> {
  return new Map(items.map((item) => [item.id, item.name]));
}

/** 収入は `+`、支出は `-` を付ける。振替はお金が増えも減りもしないので、符号を付けない。 */
function signedAmount(transaction: Transaction): string {
  if (transaction.type === 'income') return `+${formatYen(transaction.amount)}`;
  if (transaction.type === 'expense') return formatYen(-transaction.amount);
  return formatYen(transaction.amount);
}

/** 小計に符号を付ける。増えた日は `+`、減った日は `-`、0 は符号なし。 */
function signedSubtotal(subtotal: Yen): string {
  return subtotal > 0 ? `+${formatYen(subtotal)}` : formatYen(subtotal);
}

/** 月の見出し。例：`2026-09-01` → `2026年9月`。 */
function monthLabel(month: DateString): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}年${monthNumber}月`;
}

/** 絞り込みの選択肢。支出と収入のカテゴリを分けて出す。 */
const categoryGroups = [
  { type: 'expense', label: '支出' },
  { type: 'income', label: '収入' },
] as const;

/** カテゴリで絞り込む。振替はカテゴリを持たないので、絞り込むと出さない。 */
function filterByCategory(
  transactions: readonly Transaction[],
  categoryId: string,
): readonly Transaction[] {
  if (categoryId === '') return transactions;
  return transactions.filter((t) => !isTransfer(t) && t.categoryId === categoryId);
}

function subtotalClass(subtotal: Yen): string {
  if (subtotal > 0) return 'transaction-day-subtotal transaction-day-subtotal-income';
  if (subtotal < 0) return 'transaction-day-subtotal transaction-day-subtotal-expense';
  return 'transaction-day-subtotal';
}

/**
 * 取引の一覧画面。1か月分の取引を日付の新しい順に、日ごとにまとめて出す。
 * 最初は今日の月を出し、前月・翌月のボタンで月を切り替える。
 * 口座を選ぶと、その口座が関わる取引だけに絞り込む。月を切り替えても絞り込みは保つ。
 * 日ごとに収支の小計を添え、取引を押すと編集画面を開く。
 * カテゴリを選ぶと、そのカテゴリの取引だけを出す。選んだカテゴリは、月を切り替えても残す。
 * メモの検索欄にキーワードを入れると、メモにそのキーワードを含む取引だけを出す。月を切り替えてもキーワードは残す。
 */
export function TransactionList({ dbName, today }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(today ?? toDateString(new Date())));
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  /** 絞り込む口座の id。空文字はすべての口座。 */
  const [accountId, setAccountId] = useState('');
  /** 絞り込むカテゴリの id。空文字はすべてのカテゴリ。 */
  const [categoryId, setCategoryId] = useState('');
  /** メモを検索するキーワード。空文字は検索しない。 */
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      const db = await opening;
      const [transactions, categories, accounts] = await Promise.all([
        listTransactionsByDateRange(db, month, endOfMonth(month)),
        listCategories(db),
        listAccounts(db),
      ]);
      if (cancelled) return;
      setLoaded({
        month,
        // 古い順に返るので、新しい順に並べ直す。
        transactions: transactions.reverse(),
        categories,
        categoryNames: namesById(categories),
        accounts,
        accountNames: namesById(accounts),
      });
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close());
    };
  }, [dbName, month]);

  function row(transaction: Transaction, { categoryNames, accountNames }: Loaded) {
    const accountName = (id: string) => accountNames.get(id) ?? missingName;
    const title = isTransfer(transaction)
      ? '振替'
      : (categoryNames.get(transaction.categoryId) ?? missingName);
    const account = isTransfer(transaction)
      ? `${accountName(transaction.accountId)} → ${accountName(transaction.toAccountId)}`
      : accountName(transaction.accountId);
    return (
      <li key={transaction.id}>
        <a class="transaction-list-item" href={hashFromPath(`/transactions/${transaction.id}`)}>
          <span class="transaction-list-title">{title}</span>
          <span class={`transaction-list-amount transaction-list-amount-${transaction.type}`}>
            {signedAmount(transaction)}
          </span>
          <span class="transaction-list-detail">
            {account}
            {transaction.memo !== '' && ` ・ ${transaction.memo}`}
          </span>
        </a>
      </li>
    );
  }

  function day({ date, transactions, subtotal }: TransactionDay, loaded: Loaded) {
    return (
      <section key={date} class="transaction-day">
        <h3 class="transaction-day-header">
          <time class="transaction-day-date" dateTime={date}>
            {date}
          </time>
          <span class={subtotalClass(subtotal)}>
            <span class="transaction-day-subtotal-label">小計</span>
            {signedSubtotal(subtotal)}
          </span>
        </h3>
        <ul class="transaction-day-items">{transactions.map((t) => row(t, loaded))}</ul>
      </section>
    );
  }

  function categoryFilter(categories: readonly Category[]) {
    return (
      <div class="transaction-filter">
        <label for="transaction-filter-category">カテゴリ</label>
        <select
          id="transaction-filter-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.currentTarget.value)}
        >
          <option value="">すべて</option>
          {categoryGroups.map(({ type, label }) => (
            <optgroup key={type} label={label}>
              {categories
                .filter((c) => c.type === type)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
    );
  }

  function accountFilter(accounts: readonly Account[]) {
    return (
      <div class="transaction-filter">
        <label for="transaction-filter-account">口座</label>
        <select
          id="transaction-filter-account"
          value={accountId}
          onChange={(e) => setAccountId(e.currentTarget.value)}
        >
          <option value="">すべての口座</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function memoSearch() {
    return (
      <div class="transaction-filter">
        <label for="transaction-filter-memo">メモ</label>
        <input
          id="transaction-filter-memo"
          type="search"
          placeholder="キーワードで検索"
          value={keyword}
          onInput={(e) => setKeyword(e.currentTarget.value)}
        />
      </div>
    );
  }

  function body() {
    if (!loaded || loaded.month !== month) return <p>読み込み中…</p>;
    const byAccount =
      accountId === ''
        ? loaded.transactions
        : filterTransactionsByAccount(loaded.transactions, accountId);
    const transactions = filterTransactionsByMemo(filterByCategory(byAccount, categoryId), keyword);
    if (transactions.length === 0) {
      let target = monthLabel(month);
      if (accountId !== '') target += `の${loaded.accountNames.get(accountId) ?? missingName}`;
      if (categoryId !== '')
        target += `の「${loaded.categoryNames.get(categoryId) ?? missingName}」`;
      const searching = keyword.trim() !== '';
      target += searching ? `で、メモに「${keyword.trim()}」を含む取引` : 'の取引';
      return (
        <p>
          {target}はありません。
          {categoryId === '' && !searching && (
            <a href={hashFromPath('/transactions/new')}>取引を入力する</a>
          )}
        </p>
      );
    }
    return (
      <div class="transaction-list">
        {groupTransactionsByDate(transactions).map((d) => day(d, loaded))}
      </div>
    );
  }

  return (
    <>
      <h2>取引</h2>
      <nav class="transaction-month" aria-label="表示する月">
        <button type="button" onClick={() => setMonth(addMonths(month, -1))}>
          前月
        </button>
        <span class="transaction-month-label" aria-live="polite">
          {monthLabel(month)}
        </span>
        <button type="button" onClick={() => setMonth(addMonths(month, 1))}>
          翌月
        </button>
      </nav>
      {loaded && accountFilter(loaded.accounts)}
      {loaded && categoryFilter(loaded.categories)}
      {loaded && memoSearch()}
      {body()}
    </>
  );
}

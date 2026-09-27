import { useEffect, useRef, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import {
  isIncomeExpenseType,
  isTransfer,
  type IncomeExpenseType,
  type Transaction,
} from '../../domain/transaction.ts';
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
import { formatYen, parseYen, type Yen } from '../../lib/money.ts';
import { hashFromPath } from '../../router/index.ts';
import { filterTransactionsByAccount } from './filterTransactionsByAccount.ts';
import { filterTransactionsByAmount } from './filterTransactionsByAmount.ts';
import { filterTransactionsByMemo } from './filterTransactionsByMemo.ts';
import { groupTransactionsByDate, type TransactionDay } from './groupTransactionsByDate.ts';
import { paginate, type Page } from './paginate.ts';
import {
  isTransactionSortOrder,
  sortTransactions,
  type TransactionSortOrder,
} from './sortTransactions.ts';
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
  /** 1ページに出す取引の数。テストで小さくするときに渡す。 */
  pageSize?: number;
};

/** 1ページに出す取引の数の既定。 */
const defaultPageSize = 50;

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

/** 収支区分の選択肢。カテゴリの選択肢も、この順に支出と収入に分けて出す。 */
const incomeExpenseLabels = [
  { type: 'expense', label: '支出' },
  { type: 'income', label: '収入' },
] as const;

/** 並び順の選択肢。 */
const sortOrderLabels = [
  { order: 'date-desc', label: '日付の新しい順' },
  { order: 'date-asc', label: '日付の古い順' },
  { order: 'amount-desc', label: '金額の大きい順' },
  { order: 'amount-asc', label: '金額の小さい順' },
] as const;

/** 絞り込む収支区分。空文字はすべての区分。 */
type TypeFilter = IncomeExpenseType | '';

/**
 * 収支区分とカテゴリで絞り込む。どちらも空文字なら絞り込まない。
 * 振替は収支区分もカテゴリも持たないので、どちらかで絞り込むと出さない。
 */
function filterTransactions(
  transactions: readonly Transaction[],
  type: TypeFilter,
  categoryId: string,
): readonly Transaction[] {
  if (type === '' && categoryId === '') return transactions;
  return transactions.filter(
    (t) =>
      !isTransfer(t) &&
      (type === '' || t.type === type) &&
      (categoryId === '' || t.categoryId === categoryId),
  );
}

/** 金額の範囲の入力を読む。空なら `null`、円の整数に直せなければ `'invalid'` を返す。 */
function parseAmountBound(input: string): Yen | null | 'invalid' {
  if (input.trim() === '') return null;
  return parseYen(input) ?? 'invalid';
}

/** 絞り込んだ金額の範囲の言い方。例：`1,000円以上5,000円以下`。 */
function amountRangeLabel(min: Yen | null, max: Yen | null): string {
  return `${min === null ? '' : `${formatYen(min)}以上`}${max === null ? '' : `${formatYen(max)}以下`}`;
}

function subtotalClass(subtotal: Yen): string {
  if (subtotal > 0) return 'transaction-day-subtotal transaction-day-subtotal-income';
  if (subtotal < 0) return 'transaction-day-subtotal transaction-day-subtotal-expense';
  return 'transaction-day-subtotal';
}

/**
 * 取引の一覧画面。1か月分の取引を、最初は日付の新しい順に、日ごとにまとめて出す。
 * 最初は今日の月を出し、前月・翌月のボタンで月を切り替える。
 * 口座を選ぶと、その口座が関わる取引だけに絞り込む。月を切り替えても絞り込みは保つ。
 * 日ごとに収支の小計を添え、取引を押すと編集画面を開く。
 * 収支区分やカテゴリを選ぶと、その取引だけを出す。選んだものは、月を切り替えても残す。
 * 収支区分を選ぶと、カテゴリの選択肢はその区分のものだけにする。
 * メモの検索欄にキーワードを入れると、メモにそのキーワードを含む取引だけを出す。月を切り替えてもキーワードは残す。
 * 金額の下限・上限を入れると、その範囲（両端を含む）の取引だけを出す。整数に直せない入力は、その端を絞り込まない。
 * 並び順で、日付の古い順や金額の順に並べ替える。金額の順では日ごとにまとめず、取引ごとに日付を添える。
 * 選んだ並び順は、月を切り替えても残す。
 * 取引が `pageSize` 件を超えたら、ページに分けて出し、前へ・次へのボタンでページを送る。
 * 月・絞り込み・検索・並び順を変えたら、最初のページに戻す。
 * 日ごとの小計は、日がページをまたいでも、その日の取引すべてで出す。
 */
export function TransactionList({ dbName, today, pageSize = defaultPageSize }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(today ?? toDateString(new Date())));
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  /** 絞り込む口座の id。空文字はすべての口座。 */
  const [accountId, setAccountId] = useState('');
  /** 絞り込むカテゴリの id。空文字はすべてのカテゴリ。 */
  const [categoryId, setCategoryId] = useState('');
  /** 絞り込む収支区分。空文字はすべての区分。 */
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  /** メモを検索するキーワード。空文字は検索しない。 */
  const [keyword, setKeyword] = useState('');
  const [sortOrder, setSortOrder] = useState<TransactionSortOrder>('date-desc');
  /** 金額の下限と上限の入力。空文字はその端を絞り込まない。 */
  const [minAmountInput, setMinAmountInput] = useState('');
  const [maxAmountInput, setMaxAmountInput] = useState('');
  const minAmount = parseAmountBound(minAmountInput);
  const maxAmount = parseAmountBound(maxAmountInput);
  // 出す取引の組が変わったら、最初のページに戻す。組を表す値を覚えておき、変わったかを比べる。
  // 戻したことも覚えておかないと、月を進めて戻したときに、前のページが出てしまう。
  const listKey = JSON.stringify([
    month,
    accountId,
    categoryId,
    typeFilter,
    keyword,
    sortOrder,
    minAmountInput,
    maxAmountInput,
  ]);
  const [pageState, setPageState] = useState({ key: listKey, page: 1 });
  if (pageState.key !== listKey) setPageState({ key: listKey, page: 1 });
  const page = pageState.key === listKey ? pageState.page : 1;
  const listRef = useRef<HTMLDivElement>(null);

  function goToPage(next: number) {
    setPageState({ key: listKey, page: next });
    // 下のボタンで送ったときに、新しいページの頭から読めるようにする。
    listRef.current?.scrollIntoView?.({ block: 'start' });
  }

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
        transactions,
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

  /** `withDate` を立てると、口座の前に日付を添える。日ごとにまとめないときに使う。 */
  function row(
    transaction: Transaction,
    { categoryNames, accountNames }: Loaded,
    withDate = false,
  ) {
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
            {withDate && (
              <>
                <time class="transaction-list-date" dateTime={transaction.date}>
                  {transaction.date}
                </time>
                {' ・ '}
              </>
            )}
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

  function changeType(value: string, categories: readonly Category[]) {
    const next = isIncomeExpenseType(value) ? value : '';
    setTypeFilter(next);
    // 選んでいたカテゴリが別の区分のものなら、選択肢から消えるので「すべて」に戻す。
    const selected = categories.find((c) => c.id === categoryId);
    if (next !== '' && selected && selected.type !== next) setCategoryId('');
  }

  function filters(accounts: readonly Account[], categories: readonly Category[]) {
    const groups = incomeExpenseLabels.filter((g) => typeFilter === '' || g.type === typeFilter);
    return (
      <div class="transaction-filter">
        <div class="transaction-filter-field">
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
        <div class="transaction-filter-field">
          <label for="transaction-filter-type">収支区分</label>
          <select
            id="transaction-filter-type"
            value={typeFilter}
            onChange={(e) => changeType(e.currentTarget.value, categories)}
          >
            <option value="">すべて</option>
            {incomeExpenseLabels.map(({ type, label }) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div class="transaction-filter-field">
          <label for="transaction-filter-category">カテゴリ</label>
          <select
            id="transaction-filter-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.currentTarget.value)}
          >
            <option value="">すべて</option>
            {groups.map(({ type, label }) => (
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
      </div>
    );
  }

  /** 絞り込んだ結果が無いときに出す名前。カテゴリを選んでいれば、その名前を出す。 */
  function filterName(categoryNames: ReadonlyMap<string, string>): string {
    if (categoryId !== '') return categoryNames.get(categoryId) ?? missingName;
    return incomeExpenseLabels.find((g) => g.type === typeFilter)!.label;
  }

  function searchAndSort() {
    return (
      <div class="transaction-filter">
        <div class="transaction-filter-field">
          <label for="transaction-filter-memo">メモ</label>
          <input
            id="transaction-filter-memo"
            type="search"
            placeholder="キーワードで検索"
            value={keyword}
            onInput={(e) => setKeyword(e.currentTarget.value)}
          />
        </div>
        <div class="transaction-filter-field">
          <label for="transaction-sort">並び順</label>
          <select
            id="transaction-sort"
            value={sortOrder}
            onChange={(e) => {
              const value = e.currentTarget.value;
              if (isTransactionSortOrder(value)) setSortOrder(value);
            }}
          >
            {sortOrderLabels.map(({ order, label }) => (
              <option key={order} value={order}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  function amountRange() {
    return (
      <div class="transaction-filter transaction-filter-amount" role="group" aria-label="金額">
        <span>金額</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label="金額の下限"
          placeholder="下限"
          value={minAmountInput}
          aria-invalid={minAmount === 'invalid'}
          onInput={(e) => setMinAmountInput(e.currentTarget.value)}
        />
        <span aria-hidden="true">〜</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label="金額の上限"
          placeholder="上限"
          value={maxAmountInput}
          aria-invalid={maxAmount === 'invalid'}
          onInput={(e) => setMaxAmountInput(e.currentTarget.value)}
        />
      </div>
    );
  }

  /** ページ送り。ページが1つしか無ければ出さない。 */
  function pager({ page, pageCount, first, last, total }: Page<Transaction>) {
    if (pageCount <= 1) return null;
    return (
      <nav class="transaction-pager" aria-label="ページ送り">
        <button type="button" disabled={page === 1} onClick={() => goToPage(page - 1)}>
          前へ
        </button>
        <span class="transaction-pager-label" aria-live="polite">
          {page} / {pageCount}ページ（{total}件中 {first}〜{last}件目）
        </span>
        <button type="button" disabled={page === pageCount} onClick={() => goToPage(page + 1)}>
          次へ
        </button>
      </nav>
    );
  }

  function body() {
    if (!loaded || loaded.month !== month) return <p>読み込み中…</p>;
    const byAccount =
      accountId === ''
        ? loaded.transactions
        : filterTransactionsByAccount(loaded.transactions, accountId);
    const min = minAmount === 'invalid' ? null : minAmount;
    const max = maxAmount === 'invalid' ? null : maxAmount;
    const transactions = filterTransactionsByAmount(
      filterTransactionsByMemo(filterTransactions(byAccount, typeFilter, categoryId), keyword),
      min,
      max,
    );
    if (transactions.length === 0) {
      let target = monthLabel(month);
      if (accountId !== '') target += `の${loaded.accountNames.get(accountId) ?? missingName}`;
      if (categoryId !== '' || typeFilter !== '')
        target += `の「${filterName(loaded.categoryNames)}」`;
      const searching = keyword.trim() !== '';
      const byAmount = min !== null || max !== null;
      const memo = `メモに「${keyword.trim()}」を含`;
      const amount = `金額が${amountRangeLabel(min, max)}の`;
      if (searching && byAmount) target += `で、${memo}み、${amount}取引`;
      else if (searching) target += `で、${memo}む取引`;
      else if (byAmount) target += `で、${amount}取引`;
      else target += 'の取引';
      return (
        <p>
          {target}はありません。
          {categoryId === '' && typeFilter === '' && !searching && !byAmount && (
            <a href={hashFromPath('/transactions/new')}>取引を入力する</a>
          )}
        </p>
      );
    }
    const sorted = sortTransactions(transactions, sortOrder);
    const current = paginate(sorted, page, pageSize);
    // 金額の順では、同じ日の取引が離れるので、日ごとにまとめない。
    if (sortOrder === 'amount-desc' || sortOrder === 'amount-asc') {
      return (
        <>
          <div class="transaction-list" ref={listRef}>
            <ul class="transaction-day-items">{current.items.map((t) => row(t, loaded, true))}</ul>
          </div>
          {pager(current)}
        </>
      );
    }
    // 小計は、ページに出ていない分も含めた、その日の取引すべてで出す。
    const subtotals = new Map(groupTransactionsByDate(sorted).map((d) => [d.date, d.subtotal]));
    return (
      <>
        <div class="transaction-list" ref={listRef}>
          {groupTransactionsByDate(current.items).map((d) =>
            day({ ...d, subtotal: subtotals.get(d.date)! }, loaded),
          )}
        </div>
        {pager(current)}
      </>
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
      {loaded && filters(loaded.accounts, loaded.categories)}
      {loaded && searchAndSort()}
      {loaded && amountRange()}
      {body()}
    </>
  );
}

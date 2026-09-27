import { useEffect, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import { isTransfer, type Transaction } from '../../domain/transaction.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { listAccounts } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { listTransactionsNewestFirst } from '../../db/repositories/transactions.ts';
import { formatYen, type Yen } from '../../lib/money.ts';
import { hashFromPath } from '../../router/index.ts';
import { groupTransactionsByDate, type TransactionDay } from './groupTransactionsByDate.ts';
import './transactionList.css';

type Loaded = {
  transactions: Transaction[];
  categoryNames: ReadonlyMap<string, string>;
  accountNames: ReadonlyMap<string, string>;
};

type Props = {
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
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

function subtotalClass(subtotal: Yen): string {
  if (subtotal > 0) return 'transaction-day-subtotal transaction-day-subtotal-income';
  if (subtotal < 0) return 'transaction-day-subtotal transaction-day-subtotal-expense';
  return 'transaction-day-subtotal';
}

/**
 * 取引の一覧画面。すべての取引を日付の新しい順に、日ごとにまとめて出す。
 * 日ごとに収支の小計を添え、取引を押すと編集画面を開く。
 */
export function TransactionList({ dbName }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      const db = await opening;
      const [transactions, categories, accounts] = await Promise.all([
        listTransactionsNewestFirst(db),
        listCategories(db),
        listAccounts(db),
      ]);
      if (cancelled) return;
      setLoaded({
        transactions,
        categoryNames: namesById(categories),
        accountNames: namesById(accounts),
      });
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close());
    };
  }, [dbName]);

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

  function body() {
    if (!loaded) return <p>読み込み中…</p>;
    if (loaded.transactions.length === 0) {
      return (
        <p>
          取引はまだありません。
          <a href={hashFromPath('/transactions/new')}>取引を入力する</a>
        </p>
      );
    }
    return (
      <div class="transaction-list">
        {groupTransactionsByDate(loaded.transactions).map((d) => day(d, loaded))}
      </div>
    );
  }

  return (
    <>
      <h2>取引</h2>
      {body()}
    </>
  );
}

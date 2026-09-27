import { useEffect, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import { openKakeiboDB, type KakeiboDBConnection } from '../../db/index.ts';
import { listAccounts } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import {
  addTransaction,
  listRecentMemos,
  RECENT_MEMOS_LIMIT,
  type NewTransaction,
} from '../../db/repositories/transactions.ts';
import { toDateString } from '../../lib/date.ts';
import { TransactionForm } from './TransactionForm.tsx';

type Loaded = {
  db: KakeiboDBConnection;
  categories: Category[];
  accounts: Account[];
  memos: string[];
};

type Props = {
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
};

/**
 * 取引の入力画面。カテゴリと口座と過去のメモを DB から読み、入力された取引を DB に足す。
 * カテゴリと口座は、前回保存したときに選んだものを初期値にする。
 * 足した取引のメモは、次の入力から候補の先頭に出す。
 */
export function NewTransactionPage({ dbName }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      const db = await opening;
      const [categories, accounts, memos] = await Promise.all([
        listCategories(db),
        listAccounts(db),
        listRecentMemos(db),
      ]);
      if (!cancelled) setLoaded({ db, categories, accounts, memos });
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close());
    };
  }, [dbName]);

  async function save(transaction: NewTransaction) {
    if (!loaded) return;
    await addTransaction(loaded.db, transaction);
    const { memo } = transaction;
    if (memo === '') return;
    setLoaded(
      (prev) =>
        prev && {
          ...prev,
          memos: [memo, ...prev.memos.filter((m) => m !== memo)].slice(0, RECENT_MEMOS_LIMIT),
        },
    );
  }

  return (
    <>
      <h2>取引の入力</h2>
      {loaded ? (
        <TransactionForm
          categories={loaded.categories}
          accounts={loaded.accounts}
          defaults={{ date: toDateString(new Date()) }}
          rememberSelection
          memoSuggestions={loaded.memos}
          onSubmit={save}
        />
      ) : (
        <p>読み込み中…</p>
      )}
    </>
  );
}

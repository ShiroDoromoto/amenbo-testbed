import { useEffect, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import { isTransfer, type Transaction } from '../../domain/transaction.ts';
import { openKakeiboDB, type KakeiboDBConnection } from '../../db/index.ts';
import { listAccounts } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import {
  getTransaction,
  updateTransaction,
  type NewTransaction,
} from '../../db/repositories/transactions.ts';
import { navigate } from '../../router/index.ts';
import { TransactionForm } from './TransactionForm.tsx';

type Loaded = {
  db: KakeiboDBConnection;
  categories: Category[];
  accounts: Account[];
  transaction: Transaction | undefined;
};

type Props = {
  /** 編集する取引の id。 */
  id: string;
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
};

/** 取引の編集画面。id の取引を DB から読んでフォームに入れ、保存したら取引の一覧に戻る。 */
export function EditTransactionPage({ id, dbName }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      const db = await opening;
      const [categories, accounts, transaction] = await Promise.all([
        listCategories(db),
        listAccounts(db),
        getTransaction(db, id),
      ]);
      if (!cancelled) setLoaded({ db, categories, accounts, transaction });
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close());
    };
  }, [id, dbName]);

  async function save(transaction: NewTransaction) {
    if (!loaded) return;
    await updateTransaction(loaded.db, { ...transaction, id });
    navigate('/transactions');
  }

  function body() {
    if (!loaded) return <p>読み込み中…</p>;
    const { transaction } = loaded;
    if (!transaction) return <p>取引が見つかりません。消されたのかもしれません。</p>;
    // 入力フォームはまだ振替を扱えない。
    if (isTransfer(transaction)) return <p>振替の取引は、まだ編集できません。</p>;
    return (
      <TransactionForm
        categories={loaded.categories}
        accounts={loaded.accounts}
        defaults={transaction}
        onSubmit={save}
      />
    );
  }

  return (
    <>
      <h2>取引の編集</h2>
      {body()}
    </>
  );
}

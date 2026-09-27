import { useEffect, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import type { Transaction } from '../../domain/transaction.ts';
import { ConfirmDialog } from '../../components/ConfirmDialog/index.ts';
import { useToast } from '../../components/Toast/index.ts';
import { openKakeiboDB, type KakeiboDBConnection } from '../../db/index.ts';
import { listAccounts } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import {
  deleteTransaction,
  getTransaction,
  restoreTransaction,
  updateTransaction,
  type NewTransaction,
} from '../../db/repositories/transactions.ts';
import { navigate } from '../../router/index.ts';
import { TransactionForm } from './TransactionForm.tsx';
import './editTransactionPage.css';

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

/** 削除したあと、「元に戻す」ボタンを出しておくミリ秒。 */
export const UNDO_DELETE_DURATION = 5000;

/**
 * 取引の編集画面。id の取引を DB から読んでフォームに入れ、保存したら取引の一覧に戻る。
 * 確認ダイアログで確かめてから、取引を削除することもできる。
 * 削除すると取引の一覧に戻り、5秒間だけ「元に戻す」ボタンの付いたトーストを出す。
 * 押すと取引を同じ id で入れ直し、その取引の編集画面に戻る。
 */
export function EditTransactionPage({ id, dbName }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

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

  async function undoDelete(transaction: Transaction) {
    let db: KakeiboDBConnection | undefined;
    try {
      db = await openKakeiboDB(dbName);
      await restoreTransaction(db, transaction);
    } catch {
      toast.show('元に戻せませんでした', { kind: 'error' });
      return;
    } finally {
      db?.close();
    }
    toast.show('元に戻しました', { kind: 'success' });
    navigate(`/transactions/${transaction.id}`);
  }

  async function remove() {
    if (!loaded?.transaction || deleting) return;
    const { transaction } = loaded;
    setDeleting(true);
    try {
      await deleteTransaction(loaded.db, id);
    } catch {
      toast.show('削除できませんでした', { kind: 'error' });
      return;
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
    toast.show('削除しました', {
      kind: 'success',
      duration: UNDO_DELETE_DURATION,
      action: { label: '元に戻す', onClick: () => void undoDelete(transaction) },
    });
    navigate('/transactions');
  }

  function form({ categories, accounts }: Loaded, transaction: Transaction) {
    return (
      <TransactionForm
        categories={categories}
        accounts={accounts}
        defaults={transaction}
        onSubmit={save}
      />
    );
  }

  function body() {
    if (!loaded) return <p>読み込み中…</p>;
    const { transaction } = loaded;
    if (!transaction) return <p>取引が見つかりません。消されたのかもしれません。</p>;
    return (
      <>
        {form(loaded, transaction)}
        <button type="button" class="edit-transaction-delete" onClick={() => setConfirming(true)}>
          この取引を削除する
        </button>
        <ConfirmDialog
          open={confirming}
          title="取引を削除しますか？"
          confirmLabel="削除する"
          danger
          onConfirm={() => void remove()}
          onCancel={() => setConfirming(false)}
        >
          <p>削除してから5秒間は、元に戻せます。</p>
        </ConfirmDialog>
      </>
    );
  }

  return (
    <>
      <h2>取引の編集</h2>
      {body()}
    </>
  );
}

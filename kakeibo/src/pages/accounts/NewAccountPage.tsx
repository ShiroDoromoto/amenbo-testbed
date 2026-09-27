import { useEffect, useState } from 'preact/hooks';
import { useToast } from '../../components/Toast/index.ts';
import { openKakeiboDB, type KakeiboDBConnection } from '../../db/index.ts';
import { addAccount, type NewAccount } from '../../db/repositories/accounts.ts';
import { navigate } from '../../router/index.ts';
import { AccountForm } from './AccountForm.tsx';

type Props = {
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
};

/** 口座の追加画面。入力された口座を DB に足し、口座の一覧に戻る。 */
export function NewAccountPage({ dbName }: Props) {
  const [db, setDb] = useState<KakeiboDBConnection | null>(null);
  const toast = useToast();

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void opening.then((opened) => {
      if (!cancelled) setDb(opened);
    });
    return () => {
      cancelled = true;
      void opening.then((opened) => opened.close());
    };
  }, [dbName]);

  async function save(account: NewAccount) {
    if (!db) return;
    await addAccount(db, account);
    toast.show('保存しました', { kind: 'success' });
    navigate('/accounts');
  }

  return (
    <>
      <h2>口座の追加</h2>
      {db ? <AccountForm onSubmit={save} /> : <p>読み込み中…</p>}
    </>
  );
}

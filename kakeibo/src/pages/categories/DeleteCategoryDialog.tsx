import { useId, useState } from 'preact/hooks';
import { ConfirmDialog } from '../../components/ConfirmDialog/index.ts';
import type { Category } from '../../domain/category.ts';

/** 消すカテゴリと、それを使っている件数。 */
export type CategoryUsage = {
  category: Category;
  transactions: number;
  recurrings: number;
};

type Props = {
  usage: CategoryUsage;
  /** 付け替え先の候補。消すカテゴリと同じ収支区分の、ほかのカテゴリを並び順で渡す。 */
  candidates: readonly Category[];
  /** 使われていなければ `null`、使われていれば選んだ付け替え先の id を渡す。 */
  onConfirm: (toCategoryId: string | null) => void;
  onCancel: () => void;
};

/**
 * カテゴリを消す前の確認。使われているカテゴリなら、取引と定期取引の付け替え先を選ばせる。
 * 使われているのに `candidates` が空のときは出さない（呼ぶ側で止める）。
 */
export function DeleteCategoryDialog({ usage, candidates, onConfirm, onCancel }: Props) {
  const { category, transactions, recurrings } = usage;
  const used = transactions + recurrings > 0;
  const [target, setTarget] = useState(candidates[0]?.id ?? '');
  const id = useId();

  return (
    <ConfirmDialog
      open
      title={`「${category.name}」を削除しますか？`}
      confirmLabel="削除する"
      danger
      onConfirm={() => onConfirm(used ? target : null)}
      onCancel={onCancel}
    >
      {used ? (
        <>
          <p>
            このカテゴリを使っている{usageText(transactions, recurrings)}
            を、選んだカテゴリに付け替えます。
          </p>
          <div class="category-delete-target">
            <label for={`${id}-target`}>付け替え先</label>
            <select
              id={`${id}-target`}
              value={target}
              onChange={(e) => setTarget(e.currentTarget.value)}
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <p>この操作は取り消せません。</p>
      )}
    </ConfirmDialog>
  );
}

/** 「取引 3 件と定期取引 1 件」のように、0 件のものを省いて書く。 */
function usageText(transactions: number, recurrings: number): string {
  const parts: string[] = [];
  if (transactions > 0) parts.push(`取引 ${transactions} 件`);
  if (recurrings > 0) parts.push(`定期取引 ${recurrings} 件`);
  return parts.join('と');
}

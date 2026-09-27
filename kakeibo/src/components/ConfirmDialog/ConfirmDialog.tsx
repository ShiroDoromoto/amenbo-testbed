import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import './confirmDialog.css';

/** Tab で回す要素。押せないものは飛ばす。 */
const focusableSelector = [
  'button:not(:disabled)',
  'select:not(:disabled)',
  'input:not(:disabled)',
  'textarea:not(:disabled)',
].join(', ');

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** 見出しの下に出す説明。入力欄を置いてもよく、Tab で回るフォーカスの輪に入る。 */
  children?: ComponentChildren;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 削除のように取り消せない操作なら true。確定ボタンを危険の色にする。 */
  danger?: boolean;
  onConfirm: () => void;
  /** キャンセルボタン・Escape キー・背景のクリックで呼ぶ。 */
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 開いたらキャンセルにフォーカスを置き、閉じたら開く前の場所へ戻す。
  // 誤って Enter を押しても、確定しないようにするため。
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previous?.focus();
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    // フォーカスをダイアログの中で回す。説明に置いた入力欄も、その輪に入れる。
    const focusables = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []),
    ];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    // 中の文字を押してフォーカスがダイアログそのものにあるときも、輪の端へ戻す。
    if (!focusables.includes(document.activeElement as HTMLElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      class="confirm-dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        class="confirm-dialog"
        role="alertdialog"
        // 中の文字を押してもフォーカスが body へ抜けず、Escape と Tab を受け取れるようにする。
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={children ? messageId : undefined}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} class="confirm-dialog-title">
          {title}
        </h2>
        {children && (
          <div id={messageId} class="confirm-dialog-message">
            {children}
          </div>
        )}
        <div class="confirm-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            class="confirm-dialog-button confirm-dialog-cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            class={`confirm-dialog-button ${danger ? 'confirm-dialog-danger' : 'confirm-dialog-confirm'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

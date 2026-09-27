import type { ComponentChildren } from 'preact';
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import './toast.css';

export type ToastKind = 'info' | 'success' | 'error';

/** トーストに添えるボタン。押すと `onClick` を呼び、トーストを閉じる。 */
export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastOptions = {
  kind?: ToastKind;
  /** 自動で消すまでのミリ秒。0 なら、閉じるボタンを押すまで残す。 */
  duration?: number;
  action?: ToastAction;
};

export type ToastApi = {
  /** トーストを出し、その id を返す。 */
  show: (message: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
};

type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
  action?: ToastAction;
};

export const DEFAULT_TOAST_DURATION = 4000;

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast は ToastProvider の中で使う');
  return api;
}

type Props = {
  children?: ComponentChildren;
};

export function ToastProvider({ children }: Props) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (
      message: string,
      { kind = 'info', duration = DEFAULT_TOAST_DURATION, action }: ToastOptions = {},
    ) => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, message, kind, action }]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div class="toast-viewport">
        {items.map((item) => (
          <div
            key={item.id}
            class={`toast toast-${item.kind}`}
            role={item.kind === 'error' ? 'alert' : 'status'}
          >
            <p class="toast-message">{item.message}</p>
            {item.action && (
              <button
                type="button"
                class="toast-action"
                onClick={() => {
                  dismiss(item.id);
                  item.action!.onClick();
                }}
              >
                {item.action.label}
              </button>
            )}
            <button
              type="button"
              class="toast-close"
              aria-label="閉じる"
              onClick={() => dismiss(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

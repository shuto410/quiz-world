/**
 * Transient notification surface for errors and short confirmations.
 *
 * Design calls for toast copy on rejected actions. The provider owns a small queue so that
 * a second error during an existing toast does not silently disappear; each entry dismisses
 * itself after a short delay. Screens call `useToast().show(message)` and never mount the
 * markup themselves.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import './Toast.css';

export type ToastTone = 'info' | 'error';

export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

export type ToastApi = {
  show: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastApi | undefined>(undefined);

/** How long a toast stays visible before dismissing itself. */
export const TOAST_DURATION_MS = 4_000;

let nextToastId = 1;

export type ToastProviderProps = {
  children: ReactNode;
  /** Injectable clock helpers for tests. */
  scheduleDismissal?: (dismiss: () => void, delayMs: number) => () => void;
};

/** Default dismiss scheduler used in the browser. Exported for a focused unit test. */
export function scheduleWithWindow(dismiss: () => void, delayMs: number): () => void {
  const handle = window.setTimeout(dismiss, delayMs);
  return () => {
    window.clearTimeout(handle);
  };
}

export function ToastProvider({
  children,
  scheduleDismissal = scheduleWithWindow,
}: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextToastId;
    nextToastId += 1;
    setItems((current) => [...current, { id, message, tone }]);
  }, []);

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="qw-toast-region" aria-live="polite" aria-relevant="additions text">
        {items.map((item) => (
          <ToastEntry
            key={item.id}
            item={item}
            dismiss={() => {
              setItems((current) => current.filter((entry) => entry.id !== item.id));
            }}
            scheduleDismissal={scheduleDismissal}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastEntry({
  item,
  dismiss,
  scheduleDismissal,
}: {
  item: ToastItem;
  dismiss: () => void;
  scheduleDismissal: (dismiss: () => void, delayMs: number) => () => void;
}) {
  // The timer is keyed on the toast id so a parent re-render does not reset the countdown.
  useEffect(() => scheduleDismissal(dismiss, TOAST_DURATION_MS), [item.id, scheduleDismissal]);

  return (
    <div
      className={`qw-toast qw-toast--${item.tone}`}
      role={item.tone === 'error' ? 'alert' : 'status'}
    >
      {item.message}
    </div>
  );
}

/** Access the toast API from a screen under `ToastProvider`. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === undefined) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return api;
}

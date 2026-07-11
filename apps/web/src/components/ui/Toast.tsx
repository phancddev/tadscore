import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

type Toast = { id: number; message: string; tone?: 'success' | 'error' };
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(
  () => undefined,
);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now();
    setToasts((items) => [...items, { id, message, tone }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        className="fixed bottom-20 right-4 z-[100] grid max-w-sm gap-2 md:bottom-4"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'flex items-center gap-3 rounded-[var(--radius)] border bg-[var(--card)] px-4 py-3 text-sm shadow-md',
              toast.tone === 'error'
                ? 'border-[var(--destructive)]/30'
                : 'border-[var(--border)]',
            )}
          >
            <span className="flex-1 font-medium">{toast.message}</span>
            <button
              className="grid min-h-9 min-w-9 place-items-center rounded-[var(--radius)] hover:bg-[var(--muted)]"
              onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}
              aria-label={t('toast.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

import { CheckCircle2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Toast = { id: number; message: string; tone?: 'success' | 'error' };
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(
  () => undefined,
);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now();
    setToasts((items) => [...items, { id, message, tone }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4500);
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
            className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg ${toast.tone === 'error' ? 'border-red-200' : 'border-emerald-200'}`}
          >
            <CheckCircle2
              className={`h-5 w-5 ${toast.tone === 'error' ? 'text-red-700' : 'text-emerald-700'}`}
            />
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            <button
              className="grid min-h-11 min-w-11 place-items-center"
              onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}
              aria-label="Đóng thông báo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

import { AlertCircle, Inbox, RefreshCcw } from 'lucide-react';
import { Button } from './Button';

export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-label="Đang tải" className="grid gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton h-20" key={i} />
      ))}
    </div>
  );
}
export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="app-card grid place-items-center gap-2 px-5 py-12 text-center">
      <Inbox className="h-7 w-7 text-[var(--muted)]" />
      <strong>{title}</strong>
      <p className="m-0 max-w-md text-sm muted">{message}</p>
    </div>
  );
}
export function ErrorState({
  retry,
  message = 'Không thể tải dữ liệu. Vui lòng thử lại.',
}: {
  retry?: () => void;
  message?: string;
}) {
  return (
    <div role="alert" className="app-card grid place-items-center gap-3 px-5 py-10 text-center">
      <AlertCircle className="h-7 w-7 text-[var(--danger)]" />
      <p className="m-0">{message}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          <RefreshCcw className="h-4 w-4" />
          Thử lại
        </Button>
      )}
    </div>
  );
}

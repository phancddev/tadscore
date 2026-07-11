import { AlertCircle, Inbox, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Card } from './Card';

export function LoadingState({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation('common');
  return (
    <div aria-label={t('states.loading')} className="grid gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton h-16" key={i} />
      ))}
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card className="grid place-items-center gap-2 px-5 py-12 text-center">
      <Inbox className="h-6 w-6 text-[var(--muted-foreground)]" />
      <strong className="font-medium">{title}</strong>
      <p className="m-0 max-w-md text-sm text-[var(--muted-foreground)]">{message}</p>
    </Card>
  );
}

export function ErrorState({
  retry,
  message,
}: {
  retry?: () => void;
  message?: string;
}) {
  const { t } = useTranslation('common');
  return (
    <Card role="alert" className="grid place-items-center gap-3 px-5 py-10 text-center">
      <AlertCircle className="h-6 w-6 text-[var(--destructive)]" />
      <p className="m-0 text-sm">{message ?? t('states.loadError')}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          <RefreshCcw className="h-4 w-4" />
          {t('actions.retry')}
        </Button>
      )}
    </Card>
  );
}

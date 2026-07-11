import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-wrap items-end justify-between gap-3',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="m-0 text-sm text-[var(--muted-foreground)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

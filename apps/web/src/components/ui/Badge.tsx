import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'danger' | 'warning';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-[var(--surface-muted)] text-[var(--foreground)]',
    success: 'bg-[var(--success-soft)] text-[var(--success-strong)]',
    danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  };
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-bold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

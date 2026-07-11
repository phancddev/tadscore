import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

const tones = {
  neutral: 'border-transparent bg-[var(--muted)] text-[var(--foreground)]',
  success: 'border-transparent bg-[var(--success-soft)] text-[var(--success)]',
  danger: 'border-transparent bg-[var(--danger-soft)] text-[var(--destructive)]',
  warning: 'border-transparent bg-[var(--warning-soft)] text-[var(--warning)]',
  outline: 'border-[var(--border)] bg-transparent text-[var(--foreground)]',
} as const;

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-md border px-2 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

const variants = {
  default: 'border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]',
  destructive: 'border-[var(--destructive)]/30 bg-[var(--danger-soft)] text-[var(--destructive)]',
  warning: 'border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]',
  success: 'border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]',
} as const;

export function Alert({
  className,
  variant = 'default',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: keyof typeof variants;
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-[var(--radius)] border px-4 py-3 text-sm',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

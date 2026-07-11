import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Label } from './Label';

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {hint && !error && <p className="text-xs text-[var(--muted-foreground)]">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {error}
        </p>
      )}
    </div>
  );
}

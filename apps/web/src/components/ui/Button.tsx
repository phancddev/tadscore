import type { ButtonHTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
};

export function Button({
  className,
  variant = 'primary',
  loading,
  children,
  disabled,
  ...props
}: Props) {
  const variants = {
    primary: 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]',
    secondary:
      'border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--surface-muted)]',
    ghost: 'bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-muted)]',
    danger: 'bg-[var(--danger)] text-white hover:brightness-90',
  };
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-[.7rem] px-4 py-2 font-semibold transition active:scale-[.98] disabled:opacity-50',
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

import type { ButtonHTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

const variants = {
  primary:
    'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]',
  secondary:
    'border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]',
  outline:
    'border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--muted)]',
  ghost: 'bg-transparent text-[var(--foreground)] hover:bg-[var(--muted)]',
  danger:
    'bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:brightness-95',
  link: 'bg-transparent p-0 text-[var(--foreground)] underline-offset-4 hover:underline',
} as const;

const sizes = {
  default: 'min-h-11 px-4 py-2',
  sm: 'min-h-9 px-3 text-sm',
  lg: 'min-h-12 px-6',
  icon: 'h-11 w-11 p-0',
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

export function Button({
  className,
  variant = 'primary',
  size = 'default',
  loading,
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
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

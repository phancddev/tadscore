import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Metric({
  icon: Icon,
  value,
  label,
  large,
  className,
}: {
  icon?: LucideIcon;
  value: string | number;
  label: string;
  large?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)]/50 px-3 py-2 text-center',
        className,
      )}
    >
      {Icon && <Icon className="mx-auto h-4 w-4 text-[var(--muted-foreground)]" aria-hidden />}
      <strong className={cn('mt-0.5 block tabular', large ? 'text-2xl' : 'text-lg')}>{value}</strong>
      <span className="text-[11px] font-medium text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}

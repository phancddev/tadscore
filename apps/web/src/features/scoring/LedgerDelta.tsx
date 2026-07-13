import { cn } from '../../lib/cn';

export function LedgerDelta({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <strong
        className={cn(
          'text-sm font-semibold tabular',
          value > 0 && 'text-[var(--success)]',
          value < 0 && 'text-[var(--destructive)]',
          value === 0 && 'text-[var(--muted-foreground)]',
        )}
      >
        {value > 0 ? '+' : ''}
        {value}
      </strong>
      <span className="block text-[10px] text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}

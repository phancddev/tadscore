import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      to="/"
      className={cn(
        'inline-flex min-h-11 items-center gap-2 text-base font-semibold tracking-tight',
        inverse ? 'text-white' : 'text-[var(--foreground)]',
      )}
    >
      <span
        className={cn(
          'grid h-8 w-8 place-items-center rounded-[var(--radius)] border text-xs font-semibold',
          inverse
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)]',
        )}
      >
        TS
      </span>
      <span>TadScore</span>
    </Link>
  );
}

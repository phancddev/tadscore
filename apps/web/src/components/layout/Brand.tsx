import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

const LOGO_SRC = '/logo/hoh2026.jpg';

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      to="/"
      className={cn(
        'inline-flex min-h-11 items-center gap-2.5 text-base font-semibold tracking-tight',
        inverse ? 'text-white' : 'text-[var(--foreground)]',
      )}
    >
      <img
        src={LOGO_SRC}
        alt=""
        width={32}
        height={32}
        decoding="async"
        className={cn(
          'h-8 w-8 shrink-0 rounded-[var(--radius)] object-cover',
          inverse ? 'ring-1 ring-white/30' : 'border border-[var(--primary)]/25 shadow-sm',
        )}
        aria-hidden="true"
      />
      <span className={cn('font-display tracking-tight', inverse ? 'text-white' : undefined)}>
        TadScore
      </span>
    </Link>
  );
}

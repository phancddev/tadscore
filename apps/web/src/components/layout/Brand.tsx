import { Medal } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      to="/"
      className={`inline-flex min-h-11 items-center gap-2 font-extrabold tracking-[-.03em] ${inverse ? 'text-white' : 'text-[var(--foreground)]'}`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]">
        <Medal className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>TadScore</span>
    </Link>
  );
}

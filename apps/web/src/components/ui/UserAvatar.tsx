import { cn } from '../../lib/cn';

function initialOf(name?: string | null, email?: string | null) {
  const source = (name || email || '?').trim();
  return source.slice(0, 1).toUpperCase() || '?';
}

export function UserAvatar({
  name,
  email,
  avatarUrl,
  size = 'md',
  className,
  alt,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
}) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-28 w-28 text-4xl',
  } as const;
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--muted)]/50 font-semibold text-[var(--muted-foreground)]',
        sizes[size],
        className,
      )}
      aria-hidden={!alt}
    >
      <span>{initialOf(name, email)}</span>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={alt || ''}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
    </span>
  );
}

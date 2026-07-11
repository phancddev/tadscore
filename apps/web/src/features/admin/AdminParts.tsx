import type { ReactNode } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

export function AdminRow({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge: string;
  children?: ReactNode;
}) {
  return (
    <article className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] p-4 last:border-0">
      <div className="min-w-0 flex-1">
        <h2 className="m-0 break-words text-sm font-medium">{title}</h2>
        <p className="m-0 break-words text-sm text-[var(--muted-foreground)]">{subtitle}</p>
      </div>
      <Badge tone="outline">{badge}</Badge>
      {children}
    </article>
  );
}

export function AdminStatus({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="p-4">
      <Badge tone={value === 'healthy' ? 'success' : value === 'degraded' ? 'warning' : 'outline'}>
        {value}
      </Badge>
      <h2 className="mb-0 mt-3 text-sm font-medium">{title}</h2>
      <p className="m-0 mt-1 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </Card>
  );
}

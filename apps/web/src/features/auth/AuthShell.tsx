import type { ReactNode } from 'react';
import { Brand } from '../../components/layout/Brand';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <LanguageSwitcher />
        </div>
        <div className="mt-8 space-y-1">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="m-0 text-sm text-[var(--muted-foreground)]">{subtitle}</p>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}

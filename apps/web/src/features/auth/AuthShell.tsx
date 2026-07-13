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
    <main className="hoh-atmosphere hoh-atmosphere--with-mountains grid min-h-dvh place-items-center px-4 py-10">
      <div className="hoh-ornament-frame w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]/95 p-6 sm:p-8">
        <span className="hoh-corner hoh-corner-tr" aria-hidden="true" />
        <span className="hoh-corner hoh-corner-bl" aria-hidden="true" />

        <div className="flex items-center justify-between gap-3">
          <Brand />
          <LanguageSwitcher />
        </div>
        <div className="mt-8 space-y-1">
          <h1 className="page-title">{title}</h1>
          <p className="m-0 text-sm text-[var(--muted-foreground)]">{subtitle}</p>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}

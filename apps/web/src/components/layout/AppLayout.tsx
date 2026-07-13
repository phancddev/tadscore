import { Building2, LogOut, Menu, ShieldCheck, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { UserAvatar } from '../ui/UserAvatar';
import { Brand } from './Brand';

export function AppLayout() {
  const { t } = useTranslation('common');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const baseNav = [
    { to: '/workspaces', label: t('nav.workspaces'), icon: Building2 },
    { to: '/profile', label: t('nav.profile'), icon: UserRound },
  ];
  const items =
    user?.globalRole === 'super_admin'
      ? [...baseNav, { to: '/admin', label: t('nav.admin'), icon: ShieldCheck }]
      : baseNav;
  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Local logout should still complete if the server-side session already expired.
    } finally {
      await clear();
      navigate('/login', { replace: true });
    }
  };
  const nav = (onNavigate?: () => void) => (
    <nav aria-label={t('nav.main')} className="grid gap-1">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-3 rounded-[var(--radius)] px-3 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
            )
          }
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-[200] focus:bg-[var(--card)] focus:p-3"
      >
        {t('nav.skip')}
      </a>
      <aside className="hidden border-r border-[var(--border)] bg-[var(--card)]/95 p-4 lg:flex lg:min-h-dvh lg:flex-col">
        <Brand />
        <div className="mt-8">{nav()}</div>
        <div className="mt-auto border-t border-[var(--border)] pt-4">
          <div className="mb-2 flex items-center gap-3 px-3">
            <UserAvatar
              name={user?.fullName}
              email={user?.email}
              avatarUrl={user?.avatarUrl}
              size="sm"
            />
            <p className="m-0 min-w-0 truncate text-sm font-medium">{user?.fullName}</p>
          </div>
          <div className="mb-2 px-3">
            <LanguageSwitcher />
          </div>
          <button
            onClick={logout}
            className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius)] px-3 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/90 px-4 backdrop-blur lg:hidden">
          <Brand />
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <button
              className="grid min-h-11 min-w-11 place-items-center rounded-[var(--radius)] hover:bg-[var(--muted)]"
              onClick={() => setMobileOpen(true)}
              aria-label={t('nav.openMenu')}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <aside
              className="ml-auto flex h-full w-[min(82vw,320px)] flex-col border-l border-[var(--border)] bg-[var(--card)] p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <Brand />
                <button
                  aria-label={t('nav.closeMenu')}
                  className="grid min-h-11 min-w-11 place-items-center rounded-[var(--radius)] hover:bg-[var(--muted)]"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-6">{nav(() => setMobileOpen(false))}</div>
              <div className="mt-auto space-y-2">
                <div className="px-3">
                  <LanguageSwitcher />
                </div>
                <button
                  onClick={logout}
                  className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius)] px-3 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                >
                  <LogOut className="h-4 w-4" />
                  {t('nav.logout')}
                </button>
              </div>
            </aside>
          </div>
        )}
        <main id="main">
          <Outlet />
        </main>
        <nav
          aria-label={t('nav.quick')}
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t border-[var(--border)] bg-[var(--card)]/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden"
        >
          {baseNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              to={to}
              key={to}
              className={({ isActive }) =>
                cn(
                  'grid min-h-12 place-items-center rounded-[var(--radius)] text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'text-[var(--muted-foreground)]',
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

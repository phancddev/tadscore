import { Activity, History, Home, LayoutDashboard, Settings, Trophy, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { cn } from '../../lib/cn';

export function WorkspaceLayout() {
  const { t } = useTranslation('common');
  const { workspaceId } = useParams();
  const tabs = [
    ['', t('nav.overview'), LayoutDashboard],
    ['teams', t('nav.teams'), Home],
    ['score', t('nav.score'), Activity],
    ['ranking', t('nav.ranking'), Trophy],
    ['members', t('nav.members'), Users],
    ['ledger', t('nav.ledger'), History],
    ['settings', t('nav.settings'), Settings],
  ] as const;
  return (
    <div>
      <div className="no-print overflow-x-auto border-b border-[var(--border)] bg-[var(--card)]">
        <nav
          className="mx-auto flex w-max min-w-full max-w-[1280px] gap-1 px-3"
          aria-label={t('nav.workspace')}
        >
          {tabs.map(([path, label, Icon]) => (
            <NavLink
              end={!path}
              key={path}
              to={`/workspaces/${workspaceId}/${path}`}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

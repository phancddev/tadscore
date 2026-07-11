import { Activity, History, LayoutDashboard, Settings, Trophy, Users } from 'lucide-react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { cn } from '../../lib/cn';

export function WorkspaceLayout() {
  const { workspaceId } = useParams();
  const tabs = [
    ['', 'Tổng quan', LayoutDashboard],
    ['score', 'Nhập điểm', Activity],
    ['ranking', 'Xếp hạng', Trophy],
    ['members', 'Thành viên', Users],
    ['ledger', 'Lịch sử', History],
    ['settings', 'Cài đặt', Settings],
  ] as const;
  return (
    <div>
      <div className="no-print overflow-x-auto border-b border-[var(--border)] bg-[var(--card)]">
        <nav
          className="mx-auto flex w-max min-w-full max-w-[1280px] gap-1 px-3"
          aria-label="Không gian làm việc"
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
                    ? 'border-[var(--foreground)] text-[var(--foreground)]'
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

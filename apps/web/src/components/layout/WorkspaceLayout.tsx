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
      <div className="no-print overflow-x-auto border-b border-[var(--border)] bg-white">
        <nav
          className="mx-auto flex w-max min-w-full max-w-[1440px] gap-1 px-3 py-2"
          aria-label="Không gian làm việc"
        >
          {tabs.map(([path, label, Icon]) => (
            <NavLink
              end={!path}
              key={path}
              to={`/workspaces/${workspaceId}/${path}`}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold',
                  isActive
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-muted)]',
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

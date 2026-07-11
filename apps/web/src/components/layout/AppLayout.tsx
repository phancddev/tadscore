import { Building2, LogOut, Menu, ShieldCheck, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { Brand } from './Brand';

const baseNav = [
  { to: '/workspaces', label: 'Không gian', icon: Building2 },
  { to: '/profile', label: 'Hồ sơ', icon: UserRound },
];
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const items =
    user?.globalRole === 'super_admin'
      ? [...baseNav, { to: '/admin', label: 'Quản trị', icon: ShieldCheck }]
      : baseNav;
  const logout = async () => {
    await api.auth.logout();
    clear();
    navigate('/login');
  };
  const nav = (
    <nav aria-label="Điều hướng chính" className="grid gap-1">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition',
              isActive
                ? 'bg-white/15 text-white'
                : 'text-white/75 hover:bg-white/10 hover:text-white',
            )
          }
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-[200] focus:bg-white focus:p-3"
      >
        Bỏ qua điều hướng
      </a>
      <aside className="hidden bg-[var(--sidebar)] p-5 lg:flex lg:min-h-dvh lg:flex-col">
        <Brand inverse />
        <div className="mt-10">{nav}</div>
        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="mb-3 truncate text-sm font-medium text-white">{user?.fullName}</p>
          <button
            onClick={logout}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/75 hover:bg-white/10"
          >
            <LogOut className="h-5 w-5" />
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/95 px-4 backdrop-blur lg:hidden">
          <Brand />
          <button
            className="grid min-h-11 min-w-11 place-items-center"
            onClick={() => setMobileOpen(true)}
            aria-label="Mở menu"
          >
            <Menu />
          </button>
        </header>
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <aside
              className="ml-auto flex h-full w-[min(82vw,320px)] flex-col bg-[var(--sidebar)] p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <Brand inverse />
                <button
                  aria-label="Đóng menu"
                  className="grid min-h-11 min-w-11 place-items-center text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  <X />
                </button>
              </div>
              <div className="mt-8">{nav}</div>
              <button
                onClick={logout}
                className="mt-auto flex min-h-11 items-center gap-3 rounded-xl px-3 text-white"
              >
                <LogOut className="h-5 w-5" />
                Đăng xuất
              </button>
            </aside>
          </div>
        )}
        <main id="main">
          <Outlet />
        </main>
        <nav
          aria-label="Điều hướng nhanh"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t border-[var(--border)] bg-white px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
        >
          {baseNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              to={to}
              key={to}
              className={({ isActive }) =>
                cn(
                  'grid min-h-12 place-items-center rounded-xl text-xs font-semibold',
                  isActive ? 'text-[var(--primary)]' : 'text-[var(--muted)]',
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

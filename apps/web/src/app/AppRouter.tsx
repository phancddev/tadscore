import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { WorkspaceLayout } from '../components/layout/WorkspaceLayout';
import { AdminPage } from '../features/admin/AdminPage';
import { LoginPage } from '../features/auth/LoginPage';
import { ProfilePage } from '../features/auth/ProfilePage';
import { ForgotPage, ResetPage } from '../features/auth/RecoveryPages';
import { RegisterPage } from '../features/auth/RegisterPage';
import { VerifyPage } from '../features/auth/VerifyPage';
import { InternalRankingPage } from '../features/ranking/InternalRankingPage';
import { PublicRankingPage } from '../features/ranking/PublicRankingPage';
import { LedgerPage } from '../features/scoring/LedgerPage';
import { ScorePage } from '../features/scoring/ScorePage';
import { JoinPage } from '../features/workspaces/JoinPage';
import { MembersPage } from '../features/workspaces/MembersPage';
import { SettingsPage } from '../features/workspaces/SettingsPage';
import { WorkspaceOverview } from '../features/workspaces/WorkspaceOverview';
import { WorkspacesPage } from '../features/workspaces/WorkspacesPage';
import { LoadingState } from '../components/ui/State';
import { useAuth } from './AuthProvider';

function internalPath(value?: string) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : undefined;
}

function Protected() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <main className="page-shell">
        <LoadingState />
      </main>
    );
  return user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  );
}
function SuperAdmin() {
  const { user } = useAuth();
  return user?.globalRole === 'super_admin' ? <Outlet /> : <Navigate to="/workspaces" replace />;
}
function Guest() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <main className="page-shell">
        <LoadingState />
      </main>
    );
  return user ? (
    <Navigate
      to={internalPath((location.state as { from?: string })?.from) || '/workspaces'}
      replace
    />
  ) : (
    <Outlet />
  );
}
export function AppRouter() {
  return (
    <Routes>
      <Route element={<Guest />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
      <Route path="verify" element={<VerifyPage />} />
      <Route path="forgot-password" element={<ForgotPage />} />
      <Route path="reset-password" element={<ResetPage />} />
      <Route path="ranking/:token" element={<PublicRankingPage />} />
      <Route path="r/:token" element={<PublicRankingPage />} />
      <Route element={<Protected />}>
        <Route path="invite/:token" element={<JoinPage />} />
        <Route element={<AppLayout />}>
          <Route path="workspaces" element={<WorkspacesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="workspaces/:workspaceId" element={<WorkspaceLayout />}>
            <Route index element={<WorkspaceOverview />} />
            <Route path="score" element={<ScorePage />} />
            <Route path="ranking" element={<InternalRankingPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="ledger" element={<LedgerPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route element={<SuperAdmin />}>
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/workspaces" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
function NotFound() {
  return (
    <main className="page-shell grid min-h-[70dvh] place-items-center text-center">
      <div className="space-y-2">
        <p className="m-0 text-sm text-[var(--muted-foreground)]">404</p>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Không tìm thấy trang</h1>
        <a
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
          href="/"
        >
          Về trang chính
        </a>
      </div>
    </main>
  );
}

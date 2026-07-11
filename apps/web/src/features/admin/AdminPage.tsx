import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Building2, MailWarning, ScrollText, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import type { GlobalRole, UserStatus } from '../../lib/types';

type Tab = 'users' | 'workspaces' | 'audit' | 'system' | 'outbox';
const tabs = [
  { id: 'users', label: 'Tài khoản', icon: Users },
  { id: 'workspaces', label: 'Workspace', icon: Building2 },
  { id: 'audit', label: 'Audit', icon: ScrollText },
  { id: 'system', label: 'Hệ thống', icon: Activity },
  { id: 'outbox', label: 'Email', icon: MailWarning },
] as const;
export function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');
  const client = useQueryClient();
  const toast = useToast();
  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: api.admin.users,
    enabled: tab === 'users',
  });
  const workspaces = useQuery({
    queryKey: ['admin', 'workspaces'],
    queryFn: api.admin.workspaces,
    enabled: tab === 'workspaces',
  });
  const audit = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: api.admin.audit,
    enabled: tab === 'audit',
  });
  const health = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: api.admin.health,
    enabled: tab === 'system',
  });
  const rules = useQuery({
    queryKey: ['admin', 'rules'],
    queryFn: api.admin.rules,
    enabled: tab === 'system',
  });
  const outbox = useQuery({
    queryKey: ['admin', 'outbox'],
    queryFn: api.admin.outbox,
    enabled: tab === 'outbox',
  });
  const setUser = useMutation({
    mutationFn: ({
      id,
      value,
    }: {
      id: string;
      value: { status?: UserStatus; role?: GlobalRole; markVerified?: boolean };
    }) => api.admin.setUser(id, value),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast('Đã cập nhật tài khoản');
    },
  });
  const setWorkspace = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' }) =>
      api.admin.setWorkspace(id, status),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      toast('Đã cập nhật workspace');
    },
  });
  const query = { users, workspaces, audit, system: health, outbox }[tab];
  return (
    <div className="page-shell">
      <header className="mb-6">
        <p className="eyebrow">Super admin</p>
        <h1 className="page-title mt-2">Quản trị platform</h1>
        <p className="mt-2 muted">
          Quản lý vai trò hệ thống, trạng thái tài khoản, workspace và vận hành email.
        </p>
      </header>
      <div className="mb-5 overflow-x-auto">
        <div className="flex w-max gap-2" role="tablist" aria-label="Khu vực quản trị">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              role="tab"
              aria-selected={tab === id}
              key={id}
              onClick={() => setTab(id)}
              className={`flex min-h-11 items-center gap-2 rounded-xl px-4 font-semibold ${tab === id ? 'bg-[var(--primary)] text-white' : 'bg-white'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        <section className="app-card overflow-hidden">
          {tab === 'users' &&
            (!users.data?.length ? (
              <EmptyState
                title="Không có tài khoản"
                message="Chưa có tài khoản nào trong hệ thống."
              />
            ) : (
              users.data.map((user) => (
                <Row
                  key={user.id}
                  title={user.fullName}
                  subtitle={`${user.email} · @${user.username}`}
                  badge={user.emailVerifiedAt ? 'verified' : 'unverified'}
                >
                  <select
                    aria-label={`Vai trò hệ thống của ${user.email}`}
                    className="input !w-auto"
                    value={user.globalRole}
                    onChange={(event) =>
                      setUser.mutate({
                        id: user.id,
                        value: { role: event.target.value as GlobalRole },
                      })
                    }
                  >
                    <option value="user">user</option>
                    <option value="super_admin">super_admin</option>
                  </select>
                  <select
                    aria-label={`Trạng thái của ${user.email}`}
                    className="input !w-auto"
                    value={user.status}
                    onChange={(event) =>
                      setUser.mutate({
                        id: user.id,
                        value: { status: event.target.value as UserStatus },
                      })
                    }
                  >
                    <option value="pending">pending</option>
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                  </select>
                  {!user.emailVerifiedAt && (
                    <Button
                      variant="secondary"
                      onClick={() => setUser.mutate({ id: user.id, value: { markVerified: true } })}
                    >
                      Đánh dấu verified
                    </Button>
                  )}
                </Row>
              ))
            ))}
          {tab === 'workspaces' &&
            (!workspaces.data?.length ? (
              <EmptyState title="Không có workspace" message="Chưa có workspace nào." />
            ) : (
              workspaces.data.map((workspace) => (
                <Row
                  key={workspace.id}
                  title={workspace.name}
                  subtitle={`${workspace.ruleId} · ${workspace.memberCount ?? 0} thành viên · ${workspace.ownerEmail || ''}`}
                  badge={workspace.status}
                >
                  <Button
                    variant={workspace.status === 'suspended' ? 'secondary' : 'danger'}
                    onClick={() => {
                      const status = workspace.status === 'suspended' ? 'active' : 'suspended';
                      if (status === 'active' || confirm('Đình chỉ workspace này?'))
                        setWorkspace.mutate({ id: workspace.id, status });
                    }}
                  >
                    {workspace.status === 'suspended' ? 'Khôi phục' : 'Đình chỉ'}
                  </Button>
                </Row>
              ))
            ))}
          {tab === 'audit' &&
            (!audit.data?.length ? (
              <EmptyState
                title="Chưa có audit log"
                message="Các hành động quan trọng sẽ xuất hiện tại đây."
              />
            ) : (
              audit.data.map((item) => (
                <Row
                  key={item.id}
                  title={item.action}
                  subtitle={`${item.entityType} · ${new Date(item.createdAt).toLocaleString('vi-VN')}`}
                  badge={item.entityId || 'system'}
                />
              ))
            ))}
          {tab === 'system' && (
            <div className="p-5">
              <div className="grid-auto">
                <Status
                  title="API & database"
                  value={health.data?.database ? 'healthy' : 'degraded'}
                  detail={`Thời gian server: ${health.data?.time ? new Date(health.data.time).toLocaleString('vi-VN') : '—'}`}
                />
                <Status
                  title="Email outbox"
                  value={health.data?.failedEmails ? 'degraded' : 'healthy'}
                  detail={`${health.data?.failedEmails ?? 0} email lỗi`}
                />
                <Status
                  title="Xác minh email"
                  value={health.data?.emailVerificationMode || 'off'}
                  detail="Giá trị runtime đã loại bỏ secret"
                />
              </div>
              <h2 className="section-title mt-6">Rule registry</h2>
              {rules.data?.map((rule) => (
                <Row
                  key={`${rule.id}:${rule.version}`}
                  title={rule.name || rule.id}
                  subtitle={`${rule.id} · ${rule.version}`}
                  badge={rule.ok === false || rule.healthy === false ? 'error' : 'healthy'}
                />
              ))}
            </div>
          )}
          {tab === 'outbox' &&
            (!outbox.data?.length ? (
              <EmptyState
                title="Outbox trống"
                message="Email đã xếp hàng và trạng thái gửi sẽ xuất hiện tại đây."
              />
            ) : (
              outbox.data.map((item) => (
                <Row
                  key={item.id}
                  title={item.template}
                  subtitle={`${item.toEmail} · ${item.attemptCount}/${item.maxAttempts} lần · ${new Date(item.createdAt).toLocaleString('vi-VN')}`}
                  badge={item.status}
                >
                  {item.status === 'failed' && (
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        await api.admin.retryOutbox(item.id);
                        client.invalidateQueries({ queryKey: ['admin', 'outbox'] });
                        toast('Đã đưa email vào hàng đợi lại');
                      }}
                    >
                      Thử gửi lại
                    </Button>
                  )}
                </Row>
              ))
            ))}
        </section>
      )}
    </div>
  );
}
function Row({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] p-4 last:border-0">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
        <ShieldCheck className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="m-0 break-words text-base font-bold">{title}</h2>
        <p className="m-0 break-words text-sm muted">{subtitle}</p>
      </div>
      <Badge>{badge}</Badge>
      {children}
    </article>
  );
}
function Status({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] p-4">
      <Badge tone={value === 'healthy' ? 'success' : 'warning'}>{value}</Badge>
      <h2 className="mb-0 mt-3 font-bold">{title}</h2>
      <p className="m-0 text-sm muted">{detail}</p>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Building2, MailWarning, ScrollText, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import type { GlobalRole, UserStatus } from '../../lib/types';
import { AdminRow as Row, AdminStatus as Status } from './AdminParts';

type Tab = 'users' | 'workspaces' | 'audit' | 'system' | 'outbox';

const tabMeta = [
  { id: 'users' as const, key: 'page.users', icon: Users },
  { id: 'workspaces' as const, key: 'page.workspaces', icon: Building2 },
  { id: 'audit' as const, key: 'page.audit', icon: ScrollText },
  { id: 'system' as const, key: 'page.system', icon: Activity },
  { id: 'outbox' as const, key: 'page.outbox', icon: MailWarning },
];

export function AdminPage() {
  const { t, i18n } = useTranslation('admin');
  const { t: tc } = useTranslation('common');
  const [tab, setTab] = useState<Tab>('users');
  const client = useQueryClient();
  const toast = useToast();
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN';
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
      toast(t('users.updated'));
    },
  });
  const setWorkspace = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' }) =>
      api.admin.setWorkspace(id, status),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin', 'workspaces'] });
      toast(t('workspaces.updated'));
    },
  });
  const query = { users, workspaces, audit, system: health, outbox }[tab];
  return (
    <div className="page-shell">
      <PageHeader title={t('page.title')} description={t('page.description')} />
      <div className="mb-5 overflow-x-auto">
        <div
          className="flex w-max gap-1 border-b border-[var(--border)]"
          role="tablist"
          aria-label={t('page.tabsLabel')}
        >
          {tabMeta.map(({ id, key, icon: Icon }) => {
            const selected = tab === id;
            return (
              <button
                role="tab"
                aria-selected={selected}
                key={id}
                onClick={() => setTab(id)}
                className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-[var(--foreground)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t(key)}
              </button>
            );
          })}
        </div>
      </div>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        <section className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
          {tab === 'users' &&
            (!users.data?.length ? (
              <EmptyState title={t('users.emptyTitle')} message={t('users.emptyMessage')} />
            ) : (
              users.data.map((user) => (
                <Row
                  key={user.id}
                  title={user.fullName}
                  subtitle={`${user.email} · @${user.username}`}
                  badge={user.emailVerifiedAt ? t('users.verified') : t('users.unverified')}
                >
                  <Select
                    aria-label={t('users.roleOf', { email: user.email })}
                    className="!w-auto"
                    value={user.globalRole}
                    onChange={(event) =>
                      setUser.mutate({
                        id: user.id,
                        value: { role: event.target.value as GlobalRole },
                      })
                    }
                  >
                    <option value="user">{tc('roles.user')}</option>
                    <option value="super_admin">{tc('roles.super_admin')}</option>
                  </Select>
                  <Select
                    aria-label={t('users.statusOf', { email: user.email })}
                    className="!w-auto"
                    value={user.status}
                    onChange={(event) =>
                      setUser.mutate({
                        id: user.id,
                        value: { status: event.target.value as UserStatus },
                      })
                    }
                  >
                    <option value="pending">{tc('status.pending')}</option>
                    <option value="active">{tc('status.active')}</option>
                    <option value="suspended">{tc('status.suspended')}</option>
                  </Select>
                  {!user.emailVerifiedAt && (
                    <Button
                      variant="secondary"
                      onClick={() => setUser.mutate({ id: user.id, value: { markVerified: true } })}
                    >
                      {t('users.markVerified')}
                    </Button>
                  )}
                </Row>
              ))
            ))}
          {tab === 'workspaces' &&
            (!workspaces.data?.length ? (
              <EmptyState
                title={t('workspaces.emptyTitle')}
                message={t('workspaces.emptyMessage')}
              />
            ) : (
              workspaces.data.map((workspace) => (
                <Row
                  key={workspace.id}
                  title={workspace.name}
                  subtitle={`${workspace.ruleId} · ${t('workspaces.members', {
                    count: workspace.memberCount ?? 0,
                  })} · ${workspace.ownerEmail || ''}`}
                  badge={workspace.status}
                >
                  <Button
                    variant={workspace.status === 'suspended' ? 'secondary' : 'danger'}
                    onClick={() => {
                      const status = workspace.status === 'suspended' ? 'active' : 'suspended';
                      if (status === 'active' || confirm(t('workspaces.confirmSuspend')))
                        setWorkspace.mutate({ id: workspace.id, status });
                    }}
                  >
                    {workspace.status === 'suspended'
                      ? t('workspaces.activate')
                      : t('workspaces.suspend')}
                  </Button>
                </Row>
              ))
            ))}
          {tab === 'audit' &&
            (!audit.data?.length ? (
              <EmptyState title={t('audit.emptyTitle')} message={t('audit.emptyMessage')} />
            ) : (
              audit.data.map((item) => (
                <Row
                  key={item.id}
                  title={item.action}
                  subtitle={`${item.entityType} · ${new Date(item.createdAt).toLocaleString(locale)}`}
                  badge={item.entityId || 'system'}
                />
              ))
            ))}
          {tab === 'system' && (
            <div className="p-5">
              <div className="grid-auto">
                <Status
                  title={t('system.apiDb')}
                  value={health.data?.database ? 'healthy' : 'degraded'}
                  detail={t('system.serverTime', {
                    time: health.data?.time
                      ? new Date(health.data.time).toLocaleString(locale)
                      : '—',
                  })}
                />
                <Status
                  title={t('system.emailOutbox')}
                  value={health.data?.failedEmails ? 'degraded' : 'healthy'}
                  detail={t('system.failedEmails', { count: health.data?.failedEmails ?? 0 })}
                />
                <Status
                  title={t('system.emailVerification')}
                  value={health.data?.emailVerificationMode || 'off'}
                  detail={t('system.runtimeNoSecrets')}
                />
              </div>
              <h2 className="mb-2 mt-6 text-sm font-semibold">{t('system.ruleRegistry')}</h2>
              <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
                {rules.data?.map((rule) => (
                  <Row
                    key={`${rule.id}:${rule.version}`}
                    title={rule.name || rule.id}
                    subtitle={`${rule.id} · ${rule.version}`}
                    badge={rule.ok === false || rule.healthy === false ? 'error' : 'healthy'}
                  />
                ))}
              </div>
            </div>
          )}
          {tab === 'outbox' &&
            (!outbox.data?.length ? (
              <EmptyState title={t('outbox.emptyTitle')} message={t('outbox.emptyMessage')} />
            ) : (
              outbox.data.map((item) => (
                <Row
                  key={item.id}
                  title={item.template}
                  subtitle={`${item.toEmail} · ${t('outbox.attempts', {
                    attempt: item.attemptCount,
                    max: item.maxAttempts,
                  })} · ${new Date(item.createdAt).toLocaleString(locale)}`}
                  badge={item.status}
                >
                  {item.status === 'failed' && (
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        await api.admin.retryOutbox(item.id);
                        client.invalidateQueries({ queryKey: ['admin', 'outbox'] });
                        toast(t('outbox.retried'));
                      }}
                    >
                      {t('outbox.retry')}
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

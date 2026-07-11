import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Link2, MailPlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { useToast } from '../../components/ui/Toast';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { api } from '../../lib/api';
import type { Invitation, WorkspaceRole } from '../../lib/types';

const copy = async (value: string) => navigator.clipboard.writeText(value);

export function MembersPage() {
  const { t } = useTranslation('workspace');
  const { t: tc, i18n } = useTranslation('common');
  const { workspaceId = '' } = useParams();
  const client = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<WorkspaceRole, 'owner'>>('viewer');
  const members = useQuery({
    queryKey: ['members', workspaceId],
    queryFn: () => api.workspaces.members(workspaceId),
  });
  const workspace = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.workspaces.get(workspaceId),
  });
  const invitations = useQuery({
    queryKey: ['invitations', workspaceId],
    queryFn: () => api.workspaces.invitations(workspaceId),
    enabled: ['owner', 'admin'].includes(workspace.data?.role || ''),
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['members', workspaceId] });
    client.invalidateQueries({ queryKey: ['invitations', workspaceId] });
  };
  const invite = useMutation({
    mutationFn: () =>
      api.workspaces.invite(workspaceId, {
        kind: 'email',
        email,
        role,
        expiresInHours: 72,
        maxUses: 1,
      }),
    onSuccess: () => {
      refresh();
      setOpen(false);
      setEmail('');
      toast(t('members.invited'));
    },
  });
  const share = useMutation({
    mutationFn: () =>
      api.workspaces.invite(workspaceId, {
        kind: 'share_link',
        role,
        expiresInHours: 168,
        maxUses: 20,
      }),
    onSuccess: async (data) => {
      refresh();
      await copy(`${location.origin}/invite/${data.token}`);
      toast(t('members.linkCopied'));
    },
  });
  const updateRole = useMutation({
    mutationFn: ({ userId, nextRole }: { userId: string; nextRole: string }) =>
      api.workspaces.updateMember(workspaceId, userId, nextRole),
    onSuccess: () => {
      refresh();
      toast(t('members.roleUpdated'));
    },
    onError: (error: Error) => toast(error.message || tc('states.requestFailed'), 'error'),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api.workspaces.removeMember(workspaceId, userId),
    onSuccess: () => {
      refresh();
      toast(t('members.removed'));
    },
    onError: (error: Error) => toast(error.message || tc('states.requestFailed'), 'error'),
  });
  if (members.isLoading || workspace.isLoading)
    return (
      <div className="page-shell">
        <LoadingState />
      </div>
    );
  if (members.isError || workspace.isError)
    return (
      <div className="page-shell">
        <ErrorState retry={() => { members.refetch(); workspace.refetch(); }} />
      </div>
    );
  const roleCanManage = ['owner', 'admin'].includes(workspace.data?.role || '');
  const canManage = roleCanManage && workspace.data?.status === 'active';
  const status = workspace.data?.status || '';
  const statusLabel = status ? tc(`status.${status}`, { defaultValue: status }) : status;
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN';
  const activeMembers = (members.data || []).filter((member) => member.status === 'active');
  return (
    <div className="page-shell">
      <PageHeader
        title={t('members.title')}
        description={t('members.description')}
        actions={
          canManage ? (
            <>
              <Button variant="secondary" loading={share.isPending} onClick={() => share.mutate()}>
                <Copy className="h-4 w-4" />
                {t('members.inviteLink')}
              </Button>
              <Button onClick={() => setOpen(true)}>
                <MailPlus className="h-4 w-4" />
                {t('members.inviteEmail')}
              </Button>
            </>
          ) : undefined
        }
      />
      {roleCanManage && !canManage && (
        <Alert variant="warning" className="mb-5">
          <span>{t('members.readonly', { status: statusLabel })}</span>
        </Alert>
      )}
      {!activeMembers.length ? (
        <EmptyState title={t('members.emptyTitle')} message={t('members.emptyMessage')} />
      ) : (
        <Card className="divide-y divide-[var(--border)] overflow-hidden">
          {activeMembers.map((member) => {
            const canEditMember = canManage && member.role !== 'owner';
            return (
              <article key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <UserAvatar
                  name={member.fullName}
                  email={member.email}
                  avatarUrl={member.avatarUrl}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="m-0 truncate text-sm font-semibold">
                    {member.fullName || member.email}
                  </h2>
                  <p className="m-0 truncate text-sm text-[var(--muted-foreground)]">
                    {member.email}
                  </p>
                </div>
                <Badge tone="success">{tc('status.active')}</Badge>
                <Select
                  aria-label={t('members.roleOf', { email: member.email })}
                  className="!w-auto min-w-[7.5rem]"
                  value={member.role}
                  disabled={!canEditMember || updateRole.isPending}
                  onChange={(event) =>
                    updateRole.mutate({ userId: member.id, nextRole: event.target.value })
                  }
                >
                  <option value="owner" disabled>
                    {tc('roles.owner')}
                  </option>
                  <option value="admin">{tc('roles.admin')}</option>
                  <option value="scorer">{tc('roles.scorer')}</option>
                  <option value="viewer">{tc('roles.viewer')}</option>
                </Select>
                {canEditMember && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('members.removeAria', { email: member.email })}
                    className="text-[var(--destructive)]"
                    loading={removeMember.isPending && removeMember.variables === member.id}
                    disabled={removeMember.isPending}
                    onClick={() => {
                      if (confirm(t('members.confirmRemove'))) removeMember.mutate(member.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </article>
            );
          })}
        </Card>
      )}
      {roleCanManage && (
        <section className="mt-6">
          <h2 className="mb-3 m-0 text-base font-semibold tracking-tight">{t('members.pending')}</h2>
          {invitations.isLoading ? (
            <LoadingState rows={1} />
          ) : !invitations.data?.length ? (
            <EmptyState
              title={t('members.emptyInvitesTitle')}
              message={t('members.emptyInvitesMessage')}
            />
          ) : (
            <div className="grid gap-3">
              {invitations.data.map((item) => (
                <InviteRow
                  key={item.id}
                  invite={item}
                  canRevoke={canManage}
                  locale={locale}
                  onRevoke={async () => {
                    try {
                      await api.workspaces.revokeInvite(workspaceId, item.id);
                      refresh();
                      toast(t('members.revoked'));
                    } catch (error) {
                      toast(
                        error instanceof Error ? error.message : tc('states.requestFailed'),
                        'error',
                      );
                    }
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={t('members.inviteTitle')}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate();
          }}
        >
          <Field label={t('members.email')} htmlFor="invite-email">
            <Input
              type="email"
              required
              id="invite-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <RoleField role={role} setRole={setRole} />
          {invite.error && (
            <p role="alert" className="text-sm text-[var(--destructive)]">
              {invite.error.message}
            </p>
          )}
          <Button loading={invite.isPending}>{t('members.sendInvite')}</Button>
        </form>
      </Modal>
    </div>
  );
}

function RoleField({
  role,
  setRole,
}: {
  role: string;
  setRole: (role: Exclude<WorkspaceRole, 'owner'>) => void;
}) {
  const { t } = useTranslation('workspace');
  const { t: tc } = useTranslation('common');
  return (
    <Field label={t('members.grantedRole')} htmlFor="invite-role">
      <Select
        id="invite-role"
        value={role}
        onChange={(event) => setRole(event.target.value as Exclude<WorkspaceRole, 'owner'>)}
      >
        <option value="admin">{tc('roles.admin')}</option>
        <option value="scorer">{tc('roles.scorer')}</option>
        <option value="viewer">{tc('roles.viewer')}</option>
      </Select>
    </Field>
  );
}

function InviteRow({
  invite,
  canRevoke,
  locale,
  onRevoke,
}: {
  invite: Invitation;
  canRevoke: boolean;
  locale: string;
  onRevoke: () => void;
}) {
  const { t } = useTranslation('workspace');
  const { t: tc } = useTranslation('common');
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <Link2 className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
      <div className="min-w-0 flex-1">
        <strong className="text-sm font-semibold">
          {invite.kind === 'email' ? invite.email : t('members.shareLink')}
        </strong>
        <p className="m-0 text-sm text-[var(--muted-foreground)]">
          {tc(`roles.${invite.role}`, { defaultValue: invite.role })} ·{' '}
          {t('members.expires', { date: new Date(invite.expiresAt).toLocaleString(locale) })} ·{' '}
          {t('members.uses', { used: invite.useCount || 0, max: invite.maxUses })}
        </p>
      </div>
      <Badge tone={invite.status === 'pending' ? 'success' : 'warning'}>{invite.status}</Badge>
      {canRevoke && invite.status === 'pending' && (
        <Button variant="ghost" className="text-[var(--destructive)]" onClick={onRevoke}>
          {t('members.revoke')}
        </Button>
      )}
    </Card>
  );
}

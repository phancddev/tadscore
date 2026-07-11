import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Link2, MailPlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
import { api } from '../../lib/api';
import type { Invitation, WorkspaceRole } from '../../lib/types';

const copy = async (value: string) => navigator.clipboard.writeText(value);

export function MembersPage() {
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
      toast('Đã tạo và gửi lời mời');
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
      toast('Đã tạo và sao chép link mời');
    },
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
        <ErrorState
          retry={() => {
            members.refetch();
            workspace.refetch();
          }}
        />
      </div>
    );
  const roleCanManage = ['owner', 'admin'].includes(workspace.data?.role || '');
  const canManage = roleCanManage && workspace.data?.status === 'active';
  return (
    <div className="page-shell">
      <PageHeader
        title="Thành viên"
        description="Quyền workspace độc lập với quyền hệ thống."
        actions={
          canManage ? (
            <>
              <Button variant="secondary" loading={share.isPending} onClick={() => share.mutate()}>
                <Copy className="h-4 w-4" />
                Tạo link mời
              </Button>
              <Button onClick={() => setOpen(true)}>
                <MailPlus className="h-4 w-4" />
                Mời qua email
              </Button>
            </>
          ) : undefined
        }
      />
      {roleCanManage && !canManage && (
        <Alert variant="warning" className="mb-5">
          <span>
            Workspace đang {workspace.data?.status}; quản lý thành viên và lời mời tạm thời chỉ đọc.
          </span>
        </Alert>
      )}
      {!members.data?.length ? (
        <EmptyState
          title="Chưa có thành viên"
          message="Mời người dùng để cùng điều hành workspace."
        />
      ) : (
        <Card className="divide-y divide-[var(--border)] overflow-hidden">
          {members.data.map((member) => (
            <article key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--muted)]/50 text-sm font-semibold">
                {(member.fullName || member.email).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="m-0 truncate text-sm font-semibold">
                  {member.fullName || member.email}
                </h2>
                <p className="m-0 truncate text-sm text-[var(--muted-foreground)]">
                  {member.email}
                </p>
              </div>
              <Badge tone={member.status === 'active' ? 'success' : 'warning'}>
                {member.status}
              </Badge>
              <Select
                aria-label={`Quyền của ${member.email}`}
                className="!w-auto min-w-[7.5rem]"
                value={member.role}
                disabled={!canManage || member.role === 'owner'}
                onChange={async (event) => {
                  await api.workspaces.updateMember(workspaceId, member.id, event.target.value);
                  refresh();
                }}
              >
                <option value="owner" disabled>
                  Owner
                </option>
                <option value="admin">Admin</option>
                <option value="scorer">Scorer</option>
                <option value="viewer">Viewer</option>
              </Select>
              {canManage && member.role !== 'owner' && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Xóa ${member.email}`}
                  className="text-[var(--destructive)]"
                  onClick={async () => {
                    if (confirm('Xóa thành viên này?')) {
                      await api.workspaces.removeMember(workspaceId, member.id);
                      refresh();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </article>
          ))}
        </Card>
      )}
      {roleCanManage && (
        <section className="mt-6">
          <h2 className="mb-3 m-0 text-base font-semibold tracking-tight">Lời mời đang quản lý</h2>
          {invitations.isLoading ? (
            <LoadingState rows={1} />
          ) : !invitations.data?.length ? (
            <EmptyState
              title="Chưa có lời mời"
              message="Link và lời mời email sẽ xuất hiện tại đây."
            />
          ) : (
            <div className="grid gap-3">
              {invitations.data.map((item) => (
                <InviteRow
                  key={item.id}
                  invite={item}
                  canRevoke={canManage}
                  onRevoke={async () => {
                    await api.workspaces.revokeInvite(workspaceId, item.id);
                    refresh();
                    toast('Đã thu hồi lời mời');
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Mời thành viên">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate();
          }}
        >
          <Field label="Email" htmlFor="invite-email">
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
          <Button loading={invite.isPending}>Gửi lời mời</Button>
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
  return (
    <Field label="Quyền được cấp" htmlFor="invite-role">
      <Select
        id="invite-role"
        value={role}
        onChange={(event) => setRole(event.target.value as Exclude<WorkspaceRole, 'owner'>)}
      >
        <option value="admin">Admin</option>
        <option value="scorer">Scorer</option>
        <option value="viewer">Viewer</option>
      </Select>
    </Field>
  );
}

function InviteRow({
  invite,
  canRevoke,
  onRevoke,
}: {
  invite: Invitation;
  canRevoke: boolean;
  onRevoke: () => void;
}) {
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <Link2 className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
      <div className="min-w-0 flex-1">
        <strong className="text-sm font-semibold">
          {invite.kind === 'email' ? invite.email : 'Link chia sẻ'}
        </strong>
        <p className="m-0 text-sm text-[var(--muted-foreground)]">
          {invite.role} · hết hạn {new Date(invite.expiresAt).toLocaleString('vi-VN')} ·{' '}
          {invite.useCount || 0}/{invite.maxUses} lượt
        </p>
      </div>
      <Badge tone={invite.status === 'pending' ? 'success' : 'warning'}>{invite.status}</Badge>
      {canRevoke && invite.status === 'pending' && (
        <Button variant="ghost" className="text-[var(--destructive)]" onClick={onRevoke}>
          Thu hồi
        </Button>
      )}
    </Card>
  );
}

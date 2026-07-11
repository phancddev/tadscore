import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import type { ManagedTeam } from '../../lib/types';
import { TeamColorField } from './TeamColorField';

const emptyForm = {
  code: '',
  name: '',
  displayName: '',
  color: '#64748b',
  sortOrder: 0,
};

export function TeamsPage() {
  const { workspaceId = '' } = useParams();
  const toast = useToast();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedTeam | null>(null);
  const [form, setForm] = useState(emptyForm);
  const workspace = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.workspaces.get(workspaceId),
  });
  const teams = useQuery({
    queryKey: ['teams', workspaceId],
    queryFn: () => api.workspaces.teams(workspaceId),
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['teams', workspaceId] });
    client.invalidateQueries({ queryKey: ['ranking', workspaceId] });
  };
  const canManage =
    workspace.data?.status === 'active' && ['owner', 'admin'].includes(workspace.data.role);
  const close = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        displayName: form.displayName.trim() || form.name.trim(),
        color: form.color.trim() || undefined,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) return api.workspaces.updateTeam(workspaceId, editing.id, payload);
      return api.workspaces.createTeam(workspaceId, payload);
    },
    onSuccess: () => {
      refresh();
      close();
      toast(editing ? 'Đã cập nhật nhà' : 'Đã thêm nhà');
    },
  });
  const remove = useMutation({
    mutationFn: (team: ManagedTeam) => api.workspaces.deleteTeam(workspaceId, team.id),
    onSuccess: (result) => {
      refresh();
      toast(
        result && 'deactivated' in result && result.deactivated
          ? 'Đã vô hiệu hoá nhà (giữ lịch sử điểm)'
          : 'Đã xoá nhà',
      );
    },
  });
  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      sortOrder: (teams.data?.length ?? 0) + 1,
    });
    setOpen(true);
  };
  const openEdit = (team: ManagedTeam) => {
    setEditing(team);
    setForm({
      code: team.code,
      name: team.name,
      displayName: team.displayName,
      color: team.color || '#64748b',
      sortOrder: team.sortOrder ?? 0,
    });
    setOpen(true);
  };
  if (workspace.isLoading || teams.isLoading)
    return (
      <div className="page-shell">
        <LoadingState />
      </div>
    );
  if (workspace.isError || teams.isError)
    return (
      <div className="page-shell">
        <ErrorState
          retry={() => {
            workspace.refetch();
            teams.refetch();
          }}
        />
      </div>
    );
  return (
    <div className="page-shell">
      <PageHeader
        title="Quản lý nhà"
        description="Thêm, sửa hoặc xoá các nhà (kể cả nhà mặc định). Xoá nhà có lịch sử sẽ chỉ vô hiệu hoá."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Thêm nhà
            </Button>
          ) : undefined
        }
      />
      {!canManage && (
        <Alert variant="warning" className="mb-5">
          Chỉ owner/admin của workspace đang active mới được chỉnh sửa danh sách nhà.
        </Alert>
      )}
      {!teams.data?.length ? (
        <EmptyState title="Chưa có nhà" message="Thêm nhà để bắt đầu xếp hạng và nhập điểm." />
      ) : (
        <div className="grid gap-3">
          {teams.data.map((team) => (
            <Card key={team.id} className="flex flex-wrap items-center gap-3 p-4">
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-[var(--border)]"
                style={{ backgroundColor: team.color || 'var(--muted)' }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm font-medium">{team.displayName || team.name}</strong>
                  <Badge tone={team.isActive ? 'success' : 'warning'}>
                    {team.isActive ? 'active' : 'inactive'}
                  </Badge>
                </div>
                <p className="m-0 text-sm text-[var(--muted-foreground)]">
                  {team.code} · {team.name} · {team.medals ?? 0} HH · {team.pieces ?? 0} mảnh
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(team)}>
                    <Pencil className="h-4 w-4" />
                    Sửa
                  </Button>
                  {team.isActive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[var(--destructive)]"
                      loading={remove.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            `Xoá nhà "${team.displayName || team.name}"? Nhà có lịch sử điểm sẽ được vô hiệu hoá.`,
                          )
                        )
                          remove.mutate(team);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Xoá
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        api.workspaces
                          .updateTeam(workspaceId, team.id, { isActive: true })
                          .then(() => {
                            refresh();
                            toast('Đã kích hoạt lại nhà');
                          })
                          .catch((error: Error) => toast(error.message, 'error'))
                      }
                    >
                      Kích hoạt
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={open}
        onClose={close}
        title={editing ? 'Sửa nhà' : 'Thêm nhà'}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Huỷ
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              Lưu
            </Button>
          </>
        }
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Mã nhà" htmlFor="team-code" hint="Chữ/số, dùng nội bộ, ví dụ lan.">
            <Input
              id="team-code"
              required
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
            />
          </Field>
          <Field label="Tên" htmlFor="team-name">
            <Input
              id="team-name"
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Tên hiển thị" htmlFor="team-display">
            <Input
              id="team-display"
              value={form.displayName}
              onChange={(event) =>
                setForm((current) => ({ ...current, displayName: event.target.value }))
              }
              placeholder="Nhà Lan"
            />
          </Field>
          <TeamColorField
            value={form.color}
            onChange={(color) => setForm((current) => ({ ...current, color }))}
          />
          <Field label="Thứ tự" htmlFor="team-sort">
            <Input
              id="team-sort"
              type="number"
              min={0}
              max={100}
              value={form.sortOrder}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sortOrder: Number(event.target.value) || 0,
                }))
              }
            />
          </Field>
          {save.error && (
            <p role="alert" className="m-0 text-sm text-[var(--destructive)]">
              {save.error.message}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}

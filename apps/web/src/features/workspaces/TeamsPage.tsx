import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
  const { t } = useTranslation('workspace');
  const { t: tc } = useTranslation('common');
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
      toast(editing ? t('teams.updated') : t('teams.created'));
    },
  });
  const remove = useMutation({
    mutationFn: (team: ManagedTeam) => api.workspaces.deleteTeam(workspaceId, team.id),
    onSuccess: (result) => {
      refresh();
      toast(
        result && 'deactivated' in result && result.deactivated
          ? t('teams.deactivated')
          : t('teams.deleted'),
      );
    },
  });
  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sortOrder: (teams.data?.length ?? 0) + 1 });
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
  const status = workspace.data?.status || '';
  const statusLabel = status ? tc(`status.${status}`, { defaultValue: status }) : status;
  return (
    <div className="page-shell">
      <PageHeader
        title={t('teams.title')}
        description={t('teams.description')}
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('teams.add')}
            </Button>
          ) : undefined
        }
      />
      {!canManage && (
        <Alert variant="warning" className="mb-5">
          {t('teams.readonly', { status: statusLabel })}
        </Alert>
      )}
      {!teams.data?.length ? (
        <EmptyState title={t('teams.emptyTitle')} message={t('teams.emptyMessage')} />
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
                  {team.code} · {team.name} ·{' '}
                  {t('teams.stats', { medals: team.medals ?? 0, pieces: team.pieces ?? 0 })}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(team)}>
                    <Pencil className="h-4 w-4" />
                    {tc('actions.edit')}
                  </Button>
                  {team.isActive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[var(--destructive)]"
                      loading={remove.isPending}
                      onClick={() => {
                        if (
                          confirm(t('teams.confirmDelete', { name: team.displayName || team.name }))
                        )
                          remove.mutate(team);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      {tc('actions.delete')}
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
                            toast(t('teams.reactivated'));
                          })
                          .catch((error: Error) => toast(error.message, 'error'))
                      }
                    >
                      {t('teams.activate')}
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
        title={editing ? t('teams.editTitle') : t('teams.createTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              {tc('actions.cancel')}
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              {tc('actions.save')}
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
          <Field label={t('teams.code')} htmlFor="team-code" hint={t('teams.codeHint')}>
            <Input
              id="team-code"
              required
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
            />
          </Field>
          <Field label={t('teams.name')} htmlFor="team-name">
            <Input
              id="team-name"
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label={t('teams.displayName')} htmlFor="team-display">
            <Input
              id="team-display"
              value={form.displayName}
              onChange={(event) =>
                setForm((current) => ({ ...current, displayName: event.target.value }))
              }
              placeholder={t('teams.displayNamePlaceholder')}
            />
          </Field>
          <TeamColorField
            value={form.color}
            onChange={(color) => setForm((current) => ({ ...current, color }))}
          />
          <Field label={t('teams.sortOrder')} htmlFor="team-sort">
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, LockKeyhole, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';

export function SettingsPage() {
  const { workspaceId = '' } = useParams();
  const toast = useToast();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.workspaces.get(workspaceId),
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  useEffect(() => {
    setName(query.data?.name || '');
    setDescription(query.data?.description || '');
  }, [query.data]);
  const update = useMutation({
    mutationFn: (value: Parameters<typeof api.workspaces.update>[1]) =>
      api.workspaces.update(workspaceId, value),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['workspace', workspaceId] });
      toast('Đã cập nhật workspace');
    },
  });
  if (query.isLoading)
    return (
      <div className="page-shell">
        <LoadingState />
      </div>
    );
  if (query.isError || !query.data)
    return (
      <div className="page-shell">
        <ErrorState retry={() => query.refetch()} />
      </div>
    );
  const canManage = ['owner', 'admin'].includes(query.data.role);
  return (
    <div className="page-shell max-w-4xl">
      <header className="mb-7">
        <p className="eyebrow">Cấu hình</p>
        <h1 className="page-title mt-2">Cài đặt workspace</h1>
      </header>
      <form
        className="app-card grid gap-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate({ name, description });
        }}
      >
        <h2 className="section-title m-0">Thông tin chung</h2>
        <div className="field">
          <label htmlFor="settings-name">Tên workspace</label>
          <input
            className="input"
            id="settings-name"
            disabled={!canManage}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="settings-description">Mô tả</label>
          <textarea
            className="input min-h-24"
            id="settings-description"
            disabled={!canManage}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="field">
          <label>Bộ luật đã khóa phiên bản</label>
          <div className="rounded-xl bg-[var(--surface-muted)] p-3" aria-readonly="true">
            {query.data.ruleId} · {query.data.ruleVersion}
          </div>
        </div>
        {update.error && (
          <p role="alert" className="field-error">
            {update.error.message}
          </p>
        )}
        {canManage && (
          <Button className="justify-self-start" loading={update.isPending}>
            <Save className="h-4 w-4" />
            Lưu thay đổi
          </Button>
        )}
      </form>
      {canManage && (
        <section className="app-card mt-5 border-red-200 p-5">
          <h2 className="section-title m-0 text-[var(--danger)]">Trạng thái sự kiện</h2>
          <p className="text-sm muted">
            Khóa để ngừng nhập điểm tạm thời; lưu trữ khi sự kiện đã kết thúc.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={query.data.status === 'archived' || query.data.status === 'suspended'}
              onClick={() =>
                update.mutate({ status: query.data.status === 'locked' ? 'active' : 'locked' })
              }
            >
              <LockKeyhole className="h-4 w-4" />
              {query.data.status === 'locked' ? 'Mở khóa' : 'Khóa nhập điểm'}
            </Button>
            <Button
              variant="danger"
              disabled={query.data.status === 'archived' || query.data.status === 'suspended'}
              onClick={() =>
                confirm('Lưu trữ workspace này? Dữ liệu sẽ chuyển sang chỉ đọc.') &&
                update.mutate({ status: 'archived' })
              }
            >
              <Archive className="h-4 w-4" />
              Lưu trữ
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

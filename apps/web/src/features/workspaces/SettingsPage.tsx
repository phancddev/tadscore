import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, LockKeyhole, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { Textarea } from '../../components/ui/Textarea';
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
      <PageHeader title="Cài đặt workspace" />
      <Card>
        <CardHeader>
          <CardTitle>Thông tin chung</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate({ name, description });
            }}
          >
            <Field label="Tên workspace" htmlFor="settings-name">
              <Input
                id="settings-name"
                disabled={!canManage}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label="Mô tả" htmlFor="settings-description">
              <Textarea
                id="settings-description"
                disabled={!canManage}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <Field label="Bộ luật đã khóa phiên bản">
              <div
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)]/50 px-3 py-2 text-sm"
                aria-readonly="true"
              >
                {query.data.ruleId} · {query.data.ruleVersion}
              </div>
            </Field>
            {update.error && (
              <p role="alert" className="text-sm text-[var(--destructive)]">
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
        </CardContent>
      </Card>
      {canManage && (
        <Card className="mt-5 border-[var(--destructive)]/40">
          <CardHeader>
            <CardTitle className="text-[var(--destructive)]">Trạng thái sự kiện</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="m-0 text-sm text-[var(--muted-foreground)]">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

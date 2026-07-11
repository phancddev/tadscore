import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Link2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Brand } from '../../components/layout/Brand';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';

export function JoinPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const join = useMutation({
    mutationFn: () => api.workspaces.join(token),
    onSuccess: (data) => navigate(`/workspaces/${data.workspaceId}`, { replace: true }),
  });
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <section className="app-card w-full max-w-lg p-6 text-center">
        <Brand />
        <Link2 className="mx-auto mt-8 h-12 w-12 text-[var(--primary)]" />
        <h1 className="page-title mt-4">Tham gia workspace</h1>
        <p className="muted">Xác nhận để sử dụng quyền được cấp trong lời mời này.</p>
        {join.error && (
          <p role="alert" className="rounded-xl bg-[var(--danger-soft)] p-3 text-[var(--danger)]">
            {join.error.message}
          </p>
        )}
        <Button className="mt-4 w-full" loading={join.isPending} onClick={() => join.mutate()}>
          <CheckCircle2 className="h-4 w-4" />
          Xác nhận tham gia
        </Button>
      </section>
    </main>
  );
}

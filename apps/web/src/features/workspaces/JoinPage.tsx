import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Link2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Brand } from '../../components/layout/Brand';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
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
      <Card className="w-full max-w-lg">
        <CardContent className="grid gap-4 pt-6 text-center">
          <Brand />
          <Link2 className="mx-auto mt-4 h-10 w-10 text-[var(--muted-foreground)]" />
          <div className="space-y-1">
            <h1 className="m-0 text-2xl font-semibold tracking-tight">Tham gia workspace</h1>
            <p className="m-0 text-sm text-[var(--muted-foreground)]">
              Xác nhận để sử dụng quyền được cấp trong lời mời này.
            </p>
          </div>
          {join.error && <Alert variant="destructive">{join.error.message}</Alert>}
          <Button className="w-full" loading={join.isPending} onClick={() => join.mutate()}>
            <CheckCircle2 className="h-4 w-4" />
            Xác nhận tham gia
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

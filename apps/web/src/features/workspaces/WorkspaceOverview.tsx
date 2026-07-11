import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Gem, Medal, Package, Radio, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Metric } from '../../components/ui/Metric';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { api } from '../../lib/api';

export function WorkspaceOverview() {
  const { workspaceId = '' } = useParams();
  const workspace = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.workspaces.get(workspaceId),
  });
  const ranking = useQuery({
    queryKey: ['ranking', workspaceId],
    queryFn: () => api.scoring.ranking(workspaceId),
  });
  if (workspace.isLoading || ranking.isLoading)
    return (
      <div className="page-shell">
        <LoadingState />
      </div>
    );
  if (workspace.isError || ranking.isError)
    return (
      <div className="page-shell">
        <ErrorState
          retry={() => {
            workspace.refetch();
            ranking.refetch();
          }}
        />
      </div>
    );
  return (
    <div className="page-shell">
      <PageHeader
        title={workspace.data?.name || ''}
        description={`${workspace.data?.ruleId} · Phiên bản luật ${workspace.data?.ruleVersion}${
          workspace.data?.description ? ` · ${workspace.data.description}` : ''
        }`}
        actions={
          <Badge tone={workspace.data?.status === 'active' ? 'success' : 'warning'}>
            {workspace.data?.status}
          </Badge>
        }
      />
      {workspace.data?.status !== 'active' && (
        <Alert variant="warning" className="mb-5">
          <span>
            Workspace đang ở trạng thái <strong>{workspace.data?.status}</strong>. Dữ liệu chỉ đọc và
            thao tác nhập điểm đã tắt.
          </span>
        </Alert>
      )}
      <section aria-labelledby="teams-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="teams-title" className="m-0 text-base font-semibold tracking-tight">
            Tình hình các đội
          </h2>
          <Link
            className="flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--foreground)] underline-offset-4 hover:underline"
            to="ranking"
          >
            Xem xếp hạng <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid-auto">
          {ranking.data?.teams.map((team) => (
            <Card className="overflow-hidden" key={team.teamId}>
              <div className="h-1" style={{ backgroundColor: team.color || 'var(--primary)' }} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--muted-foreground)]">
                    Hạng {team.rank}
                  </span>
                  <Badge tone={team.eligible ? 'success' : 'neutral'}>
                    {team.eligible ? 'Đủ điều kiện' : 'Đang tích lũy'}
                  </Badge>
                </div>
                <h3 className="m-0 text-xl font-semibold tracking-tight">
                  {team.displayName || team.name}
                </h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  <Metric icon={Medal} value={team.medals} label="Huy hiệu" />
                  <Metric icon={Gem} value={team.pieces} label="Mảnh ghép" />
                  <Metric icon={Package} value={team.items} label="Vật phẩm" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Link to="score" className="block">
          <Card className="flex min-h-20 items-center gap-4 p-5 transition-colors hover:bg-[var(--muted)]/40">
            <Radio className="h-5 w-5 shrink-0 text-[var(--muted-foreground)]" />
            <div>
              <h2 className="m-0 text-base font-semibold">Nhập điểm trực tiếp</h2>
              <p className="m-0 text-sm text-[var(--muted-foreground)]">
                Xếp hạng game và thao tác nhanh
              </p>
            </div>
          </Card>
        </Link>
        <Link to="members" className="block">
          <Card className="flex min-h-20 items-center gap-4 p-5 transition-colors hover:bg-[var(--muted)]/40">
            <Users className="h-5 w-5 shrink-0 text-[var(--muted-foreground)]" />
            <div>
              <h2 className="m-0 text-base font-semibold">Quản lý thành viên</h2>
              <p className="m-0 text-sm text-[var(--muted-foreground)]">
                Phân quyền và mời cộng tác
              </p>
            </div>
          </Card>
        </Link>
      </section>
    </div>
  );
}

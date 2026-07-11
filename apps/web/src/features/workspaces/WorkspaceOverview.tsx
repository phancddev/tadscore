import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Gem, Medal, Package, Radio, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
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
      <header className="mb-7">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow m-0">{workspace.data?.ruleId}</p>
          <Badge tone={workspace.data?.status === 'active' ? 'success' : 'warning'}>
            {workspace.data?.status}
          </Badge>
        </div>
        <h1 className="page-title mt-2">{workspace.data?.name}</h1>
        <p className="mt-2 muted">
          Phiên bản luật {workspace.data?.ruleVersion}
          {workspace.data?.description ? ` · ${workspace.data.description}` : ''}
        </p>
      </header>
      {workspace.data?.status !== 'active' && (
        <div
          role="status"
          className="mb-5 rounded-xl bg-[var(--warning-soft)] p-4 text-[var(--warning)]"
        >
          Workspace đang ở trạng thái <strong>{workspace.data?.status}</strong>. Dữ liệu chỉ đọc và
          thao tác nhập điểm đã tắt.
        </div>
      )}
      <section aria-labelledby="teams-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="teams-title" className="section-title">
            Tình hình các đội
          </h2>
          <Link
            className="flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--primary)]"
            to="ranking"
          >
            Xem xếp hạng <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid-auto">
          {ranking.data?.teams.map((team) => (
            <article className="app-card overflow-hidden" key={team.teamId}>
              <div className="h-1.5" style={{ backgroundColor: team.color || 'var(--primary)' }} />
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold muted">Hạng {team.rank}</span>
                  <Badge tone={team.eligible ? 'success' : 'neutral'}>
                    {team.eligible ? 'Đủ điều kiện' : 'Đang tích lũy'}
                  </Badge>
                </div>
                <h3 className="my-3 text-2xl font-extrabold">{team.displayName || team.name}</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric icon={Medal} value={team.medals} label="Huy hiệu" />
                  <Metric icon={Gem} value={team.pieces} label="Mảnh ghép" />
                  <Metric icon={Package} value={team.items} label="Vật phẩm" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Link to="score" className="app-card flex min-h-20 items-center gap-4 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
            <Radio />
          </span>
          <div>
            <h2 className="m-0 font-bold">Nhập điểm trực tiếp</h2>
            <p className="m-0 text-sm muted">Xếp hạng game và thao tác nhanh</p>
          </div>
        </Link>
        <Link to="members" className="app-card flex min-h-20 items-center gap-4 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--surface-muted)]">
            <Users />
          </span>
          <div>
            <h2 className="m-0 font-bold">Quản lý thành viên</h2>
            <p className="m-0 text-sm muted">Phân quyền và mời cộng tác</p>
          </div>
        </Link>
      </section>
    </div>
  );
}
function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Medal;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] p-3">
      <Icon className="mx-auto h-4 w-4 text-[var(--primary)]" />
      <strong className="mt-1 block text-xl tabular">{value}</strong>
      <span className="text-[11px] font-semibold muted">{label}</span>
    </div>
  );
}

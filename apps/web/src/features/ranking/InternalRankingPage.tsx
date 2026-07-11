import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, Link2Off, RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/State';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import type { PublicLink, Team, TeamDetail } from '../../lib/types';
import { Leaderboard } from './Leaderboard';
import { TeamDetailView } from './TeamDetailView';

export function InternalRankingPage() {
  const { workspaceId = '' } = useParams();
  const toast = useToast();
  const client = useQueryClient();
  const [created, setCreated] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<Team>();
  const workspace = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.workspaces.get(workspaceId),
  });
  const ranking = useQuery({
    queryKey: ['ranking', workspaceId],
    queryFn: () => api.scoring.ranking(workspaceId),
  });
  const links = useQuery({
    queryKey: ['public-links', workspaceId],
    queryFn: () => api.workspaces.publicLinks(workspaceId),
    enabled: ['owner', 'admin'].includes(workspace.data?.role || ''),
  });
  const detail = useQuery({
    queryKey: ['team-detail', workspaceId, team?.teamId],
    queryFn: () => api.scoring.teamDetail(workspaceId, team!.teamId),
    enabled: !!team,
  });
  const create = useMutation({
    mutationFn: () => api.workspaces.createPublicLink(workspaceId, { label: 'Bảng xếp hạng' }),
    onSuccess: (link) => {
      if (link.token) setCreated((current) => ({ ...current, [link.id]: link.token! }));
      client.invalidateQueries({ queryKey: ['public-links', workspaceId] });
      toast('Đã tạo link public');
    },
  });
  if (workspace.isLoading || ranking.isLoading)
    return (
      <div className="page-shell">
        <LoadingState />
      </div>
    );
  if (workspace.isError || ranking.isError || !ranking.data)
    return (
      <div className="page-shell">
        <ErrorState retry={() => ranking.refetch()} />
      </div>
    );
  const roleCanManage = ['owner', 'admin'].includes(workspace.data?.role || '');
  const canManage = roleCanManage && workspace.data?.status === 'active';
  return (
    <div className="page-shell">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Xếp hạng nội bộ</p>
          <h1 className="page-title mt-2">Bảng xếp hạng</h1>
          <p className="mt-2 muted">Chọn một đội để xem chi tiết các giao dịch điểm.</p>
        </div>
        {canManage && (
          <Button loading={create.isPending} onClick={() => create.mutate()}>
            Tạo link public
          </Button>
        )}
      </header>
      {roleCanManage && !canManage && (
        <div
          role="status"
          className="mb-5 rounded-xl bg-[var(--warning-soft)] p-4 text-[var(--warning)]"
        >
          Workspace đang {workspace.data?.status}; link public hiện chỉ đọc và không thể tạo mới.
        </div>
      )}
      <Leaderboard ranking={ranking.data} onTeam={setTeam} />
      {roleCanManage && (
        <section className="mt-7">
          <h2 className="section-title">Link public</h2>
          {links.isLoading ? (
            <LoadingState rows={1} />
          ) : !links.data?.length ? (
            <EmptyState
              title="Chưa có link public"
              message="Tạo link để khách xem ranking không cần đăng nhập."
            />
          ) : (
            <div className="grid gap-3">
              {links.data.map((link) => (
                <PublicLinkRow
                  key={link.id}
                  link={link}
                  token={created[link.id]}
                  workspaceId={workspaceId}
                  onToken={(token) => setCreated((current) => ({ ...current, [link.id]: token }))}
                  onRefresh={() =>
                    client.invalidateQueries({ queryKey: ['public-links', workspaceId] })
                  }
                  readOnly={!canManage}
                />
              ))}
            </div>
          )}
        </section>
      )}
      <Modal
        open={!!team}
        onClose={() => setTeam(undefined)}
        title={team?.displayName || team?.name || 'Chi tiết đội'}
      >
        {detail.isLoading ? (
          <LoadingState />
        ) : detail.isError ? (
          <ErrorState retry={() => detail.refetch()} />
        ) : detail.data ? (
          <TeamDetailView detail={detail.data as TeamDetail} />
        ) : null}
      </Modal>
    </div>
  );
}
function PublicLinkRow({
  link,
  token,
  workspaceId,
  onToken,
  onRefresh,
  readOnly,
}: {
  link: PublicLink;
  token?: string;
  workspaceId: string;
  onToken: (token: string) => void;
  onRefresh: () => void;
  readOnly: boolean;
}) {
  const toast = useToast();
  const url = token ? `${location.origin}/ranking/${token}` : '';
  return (
    <article className="app-card flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <strong>{link.label || 'Bảng xếp hạng'}</strong>
        <p className="m-0 text-sm muted">
          {link.isEnabled ? 'Đang hoạt động' : 'Đã thu hồi'}
          {link.expiresAt
            ? ` · hết hạn ${new Date(link.expiresAt).toLocaleString('vi-VN')}`
            : ' · không hết hạn'}
        </p>
      </div>
      {!readOnly && url && (
        <>
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              toast('Đã sao chép link');
            }}
          >
            <Copy className="h-4 w-4" />
            Sao chép
          </Button>
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-4 font-bold"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Mở
          </a>
        </>
      )}
      {!readOnly && (
        <Button
          variant="ghost"
          onClick={async () => {
            const result = await api.workspaces.regeneratePublicLink(workspaceId, link.id);
            if (result.token) onToken(result.token);
            onRefresh();
          }}
        >
          <RefreshCcw className="h-4 w-4" />
          {url ? 'Đổi token' : 'Lấy link mới'}
        </Button>
      )}
      {!readOnly && link.isEnabled && (
        <Button
          variant="ghost"
          className="text-[var(--danger)]"
          onClick={async () => {
            if (confirm('Thu hồi link public này?')) {
              await api.workspaces.revokePublicLink(workspaceId, link.id);
              onRefresh();
            }
          }}
        >
          <Link2Off className="h-4 w-4" />
          Thu hồi
        </Button>
      )}
    </article>
  );
}

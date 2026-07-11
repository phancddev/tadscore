import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Expand, Radio, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams } from 'react-router-dom';
import { Brand } from '../../components/layout/Brand';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ErrorState, LoadingState } from '../../components/ui/State';
import { API_BASE, api } from '../../lib/api';
import type { Ranking, Team } from '../../lib/types';
import { Leaderboard } from './Leaderboard';
import { TeamDetailView } from './TeamDetailView';

export function PublicRankingPage() {
  const { token = '' } = useParams();
  const client = useQueryClient();
  const [presenter, setPresenter] = useState(false);
  const [team, setTeam] = useState<Team>();
  const [qr, setQr] = useState(false);
  const [connected, setConnected] = useState(false);
  const query = useQuery({
    queryKey: ['public-ranking', token],
    queryFn: () => api.public.ranking(token),
    refetchInterval: connected ? false : 15_000,
  });
  const detail = useQuery({
    queryKey: ['public-team', token, team?.teamId],
    queryFn: () => api.public.team(token, team!.teamId),
    enabled: !!team,
  });
  useEffect(() => {
    if (!token) return;
    const events = new EventSource(`${API_BASE}/public/rankings/${token}/events`);
    const update = (event: MessageEvent) => {
      try {
        client.setQueryData(['public-ranking', token], JSON.parse(event.data) as Ranking);
        setConnected(true);
      } catch {
        query.refetch();
      }
    };
    events.addEventListener('ranking', update as EventListener);
    events.onopen = () => setConnected(true);
    events.onerror = () => setConnected(false);
    return () => events.close();
  }, [token, client]);
  useEffect(() => {
    const change = () => setPresenter(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  const fullscreen = async () => {
    setPresenter(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      /* presenter layout still works */
    }
  };
  if (query.isLoading)
    return (
      <main className="page-shell">
        <LoadingState rows={4} />
      </main>
    );
  if (query.isError || !query.data)
    return (
      <main className="page-shell">
        <ErrorState
          retry={() => query.refetch()}
          message="Bảng xếp hạng không tồn tại hoặc đã bị thu hồi."
        />
      </main>
    );
  return (
    <main
      className={`min-h-dvh ${presenter ? 'bg-[var(--background)] p-4 md:p-8 2xl:p-12' : 'page-shell'}`}
    >
      <header
        className={`mb-6 flex flex-wrap items-center justify-between gap-4 ${presenter ? 'md:mb-10' : ''}`}
      >
        <div>
          {!presenter && <Brand />}
          <p className={`eyebrow ${presenter ? 'text-base' : 'mt-5'}`}>
            {query.data.rule.id} · {query.data.rule.version}
          </p>
          <h1
            className={`m-0 mt-1 font-extrabold tracking-[-.04em] ${presenter ? 'text-4xl md:text-6xl' : 'text-3xl md:text-5xl'}`}
          >
            {query.data.workspace.name}
          </h1>
          <p className="m-0 mt-2 flex items-center gap-2 text-sm muted">
            <Radio
              className={`h-4 w-4 ${connected ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
            />
            {connected ? 'Đang cập nhật trực tiếp' : 'Đang kết nối lại'}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {presenter ? (
            <Button
              variant="secondary"
              onClick={() => {
                setPresenter(false);
                document.exitFullscreen?.();
              }}
            >
              <X className="h-4 w-4" />
              Thoát trình chiếu
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setQr(true)}>
                <Share2 className="h-4 w-4" />
                Chia sẻ
              </Button>
              <Button onClick={fullscreen}>
                <Expand className="h-4 w-4" />
                Trình chiếu
              </Button>
            </>
          )}
        </div>
      </header>
      <Leaderboard
        ranking={query.data}
        presenter={presenter}
        onTeam={presenter ? undefined : setTeam}
      />
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
          <TeamDetailView detail={detail.data} publicView />
        ) : null}
      </Modal>
      <Modal open={qr} onClose={() => setQr(false)} title="Chia sẻ bảng xếp hạng">
        <div className="grid place-items-center gap-4 text-center">
          <QRCodeSVG value={location.href} size={220} level="M" />
          <p className="m-0 break-all text-sm muted">{location.href}</p>
          <Button variant="secondary" onClick={() => navigator.clipboard.writeText(location.href)}>
            Sao chép liên kết
          </Button>
        </div>
      </Modal>
    </main>
  );
}

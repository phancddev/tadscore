import { Gem, MessageCircleMore, Package, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import type { Team } from '../../lib/types';

export type QuickAction = {
  teamId: string;
  mode: 'speech' | 'violation' | 'piece' | 'item';
  value: number;
  reason: string;
};
export function QuickActions({
  teams,
  saving,
  disabled,
  onQuick,
  onPurchase,
}: {
  teams: Team[];
  saving: boolean;
  disabled?: boolean;
  onQuick: (data: QuickAction) => void;
  onPurchase: (data: QuickAction) => void;
}) {
  const [teamId, setTeamId] = useState('');
  const [mode, setMode] = useState<QuickAction['mode']>('speech');
  const [value, setValue] = useState(1);
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!teamId && teams[0]) setTeamId(teams[0].teamId);
  }, [teamId, teams]);
  const modes = [
    { id: 'speech', label: 'Phát biểu', icon: MessageCircleMore },
    { id: 'violation', label: 'Vi phạm', icon: ShieldAlert },
    { id: 'piece', label: 'Mảnh ghép', icon: Gem },
    { id: 'item', label: 'Vật phẩm', icon: Package },
  ] as const;
  const submit = () => {
    const data = {
      teamId,
      mode,
      value,
      reason:
        reason.trim() ||
        (mode === 'speech' ? 'Phát biểu' : mode === 'violation' ? 'Vi phạm' : 'Mua từ cửa hàng'),
    };
    if (mode === 'piece' || mode === 'item') onPurchase(data);
    else onQuick(data);
  };
  return (
    <section className="app-card p-4 md:p-6">
      <h2 className="section-title m-0">Thao tác nhanh</h2>
      <p className="mb-5 mt-1 text-sm muted">
        Cộng phát biểu, trừ vi phạm hoặc mua trong cửa hàng.
      </p>
      <fieldset disabled={disabled}>
        <div className="grid grid-cols-2 gap-2">
          {modes.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              aria-pressed={mode === id}
              onClick={() => {
                setMode(id);
                setValue(1);
              }}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-bold ${mode === id ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]' : 'border-[var(--border)]'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4">
          <div className="field">
            <label htmlFor="quick-team">Đội</label>
            <select
              id="quick-team"
              className="input"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
            >
              {teams.map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.displayName || team.name} · {team.medals} huy hiệu
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="quick-value">
              {mode === 'violation'
                ? 'Mức trừ'
                : mode === 'speech'
                  ? 'Số huy hiệu cộng'
                  : 'Số lượng'}
            </label>
            {mode === 'violation' ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 5].map((number) => (
                  <button
                    type="button"
                    key={number}
                    onClick={() => setValue(number)}
                    aria-pressed={value === number}
                    className={`min-h-11 rounded-xl border font-bold ${value === number ? 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]' : 'border-[var(--border)]'}`}
                  >
                    −{number}
                  </button>
                ))}
              </div>
            ) : mode === 'speech' ? (
              <div id="quick-value" className="input flex items-center" aria-readonly="true">
                +1 huy hiệu theo bộ luật
              </div>
            ) : (
              <input
                id="quick-value"
                className="input"
                type="number"
                min="1"
                value={value}
                onChange={(event) => setValue(Math.max(1, Number(event.target.value)))}
              />
            )}
          </div>
          {(mode === 'speech' || mode === 'violation') && (
            <div className="field">
              <label htmlFor="quick-reason">Lý do / ghi chú</label>
              <input
                id="quick-reason"
                className="input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={mode === 'speech' ? 'Phát biểu' : 'Vi phạm'}
              />
            </div>
          )}
          <Button loading={saving} disabled={!teamId} onClick={submit}>
            {mode === 'piece' || mode === 'item' ? 'Xác nhận mua' : 'Ghi nhận'}
          </Button>
        </div>
      </fieldset>
    </section>
  );
}

import { Gem, MessageCircleMore, Package, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { cn } from '../../lib/cn';
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
    <Card>
      <CardHeader>
        <CardTitle>Thao tác nhanh</CardTitle>
        <CardDescription>Cộng phát biểu, trừ vi phạm hoặc mua trong cửa hàng.</CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
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
                className={cn(
                  'flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] border px-2 text-sm font-medium transition-colors',
                  mode === id
                    ? 'border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)]'
                    : 'border-[var(--border)] bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50',
                )}
              >
                <Icon className="h-4 w-4 opacity-70" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-4">
            <Field label="Đội" htmlFor="quick-team">
              <Select
                id="quick-team"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team.teamId} value={team.teamId}>
                    {team.displayName || team.name} · {team.medals} huy hiệu
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={
                mode === 'violation'
                  ? 'Mức trừ'
                  : mode === 'speech'
                    ? 'Số huy hiệu cộng'
                    : 'Số lượng'
              }
              htmlFor="quick-value"
            >
              {mode === 'violation' ? (
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 5].map((number) => (
                    <button
                      type="button"
                      key={number}
                      onClick={() => setValue(number)}
                      aria-pressed={value === number}
                      className={cn(
                        'min-h-11 rounded-[var(--radius)] border text-sm font-medium transition-colors',
                        value === number
                          ? 'border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)]'
                          : 'border-[var(--border)] bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50',
                      )}
                    >
                      −{number}
                    </button>
                  ))}
                </div>
              ) : mode === 'speech' ? (
                <div
                  id="quick-value"
                  className="flex min-h-11 items-center rounded-[var(--radius)] border border-[var(--input)] bg-[var(--muted)]/40 px-3 py-2 text-sm text-[var(--muted-foreground)]"
                  aria-readonly="true"
                >
                  +1 huy hiệu theo bộ luật
                </div>
              ) : (
                <Input
                  id="quick-value"
                  type="number"
                  min={1}
                  value={value}
                  onChange={(event) => setValue(Math.max(1, Number(event.target.value)))}
                />
              )}
            </Field>
            {(mode === 'speech' || mode === 'violation') && (
              <Field label="Lý do / ghi chú" htmlFor="quick-reason">
                <Input
                  id="quick-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={mode === 'speech' ? 'Phát biểu' : 'Vi phạm'}
                />
              </Field>
            )}
            <Button loading={saving} disabled={!teamId} onClick={submit}>
              {mode === 'piece' || mode === 'item' ? 'Xác nhận mua' : 'Ghi nhận'}
            </Button>
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}

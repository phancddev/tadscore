import { ArrowUpDown, Gem, Package } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { parseMedalDelta } from './parseMedalDelta';

export type QuickAction = {
  teamId: string;
  mode: 'manual' | 'piece' | 'item';
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
  const [mode, setMode] = useState<QuickAction['mode']>('manual');
  const [deltaText, setDeltaText] = useState('+1');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!teamId && teams[0]) setTeamId(teams[0].teamId);
  }, [teamId, teams]);
  const modes = [
    { id: 'manual' as const, label: 'Cộng/trừ điểm', icon: ArrowUpDown },
    { id: 'piece' as const, label: 'Mảnh ghép', icon: Gem },
    { id: 'item' as const, label: 'Vật phẩm', icon: Package },
  ];
  const parsed = useMemo(
    () => (mode === 'manual' ? parseMedalDelta(deltaText) : { ok: true as const, value: quantity }),
    [deltaText, mode, quantity],
  );
  const submit = () => {
    if (!teamId || !parsed.ok) return;
    if (mode === 'manual') {
      onQuick({
        teamId,
        mode,
        value: parsed.value,
        reason: reason.trim() || (parsed.value > 0 ? 'Cộng điểm thủ công' : 'Trừ điểm thủ công'),
      });
      return;
    }
    if (quantity < 1) return;
    onPurchase({
      teamId,
      mode,
      value: quantity,
      reason: reason.trim() || 'Mua từ cửa hàng',
    });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thao tác nhanh</CardTitle>
        <CardDescription>
          Nhập +5 / -2 để cộng trừ huy hiệu, hoặc mua mảnh ghép / vật phẩm. Tổng điểm có thể âm.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
          <div className="grid grid-cols-3 gap-2">
            {modes.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
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
            {mode === 'manual' ? (
              <Field
                label="Mức thay đổi huy hiệu"
                htmlFor="quick-delta"
                error={!parsed.ok ? parsed.error : undefined}
                hint="Ví dụ: +5, -2, 10. Cho phép tổng điểm âm."
              >
                <Input
                  id="quick-delta"
                  inputMode="text"
                  autoComplete="off"
                  placeholder="+5 hoặc -2"
                  value={deltaText}
                  onChange={(event) => setDeltaText(event.target.value)}
                  aria-invalid={!parsed.ok}
                />
              </Field>
            ) : (
              <Field label="Số lượng" htmlFor="quick-value">
                <Input
                  id="quick-value"
                  type="number"
                  min={1}
                  max={100}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))
                  }
                />
              </Field>
            )}
            {mode === 'manual' && (
              <Field label="Lý do / ghi chú" htmlFor="quick-reason">
                <Input
                  id="quick-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ghi chú (tuỳ chọn)"
                />
              </Field>
            )}
            <Button loading={saving} disabled={!teamId || !parsed.ok} onClick={submit}>
              {mode === 'manual' ? 'Ghi nhận điểm' : 'Xác nhận mua'}
            </Button>
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}

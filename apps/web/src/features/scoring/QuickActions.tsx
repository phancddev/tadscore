import { ArrowUpDown, Gem, Package } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
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
import { ItemIntro, PieceIntro, PurchaseFields } from './ShopModePanel';
import type { ShopConfig } from './shopConfig';

export type { ShopConfig } from './shopConfig';
export { shopConfigFromRanking } from './shopConfig';

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
  shop,
  shopReady = true,
  onQuick,
  onPurchase,
}: {
  teams: Team[];
  saving: boolean;
  disabled?: boolean;
  /** From ranking.shop (workspace snapshot). Null while missing. */
  shop: ShopConfig | null;
  shopReady?: boolean;
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

  const team = teams.find((item) => item.teamId === teamId);
  const shopItem = mode === 'piece' ? shop?.piece : mode === 'item' ? shop?.item : undefined;
  const unitCost = shopItem?.medalCost ?? 0;
  const unitGain =
    mode === 'piece'
      ? (shopItem?.pieceDelta ?? 1)
      : mode === 'item'
        ? (shopItem?.itemDelta ?? 1)
        : 0;
  const totalCost = unitCost * quantity;
  const parsed = useMemo(
    () => (mode === 'manual' ? parseMedalDelta(deltaText) : { ok: true as const, value: quantity }),
    [deltaText, mode, quantity],
  );
  const purchaseBlockers = useMemo(() => {
    if (mode === 'manual') return [] as string[];
    if (!shopReady || !shop) return ['Đang tải cấu hình shop của workspace…'] as string[];
    if (!team || !shopItem) return ['Không có cấu hình shop trong rule snapshot.'] as string[];
    const issues: string[] = [];
    if (quantity < 1) issues.push('Số lượng phải từ 1 trở lên.');
    if (team.medals < totalCost)
      issues.push(
        `Không đủ huy hiệu: cần ${totalCost} HH, đội đang có ${team.medals} HH (thiếu ${totalCost - team.medals}).`,
      );
    if (mode === 'piece' && shop.pieceLimit?.active) {
      const bought = team.shopPiecesBought ?? 0;
      const remaining = Math.max(0, shop.pieceLimit.max - bought);
      if (bought + quantity > shop.pieceLimit.max)
        issues.push(
          `Limit shop: trước ${shop.pieceLimit.activityKey} mỗi đội tối đa ${shop.pieceLimit.max} mảnh (đã mua ${bought}, còn ${remaining}).`,
        );
    }
    return issues;
  }, [mode, shopReady, shop, team, shopItem, quantity, totalCost]);

  const canSubmit =
    !!teamId &&
    parsed.ok &&
    (mode === 'manual' || (shopReady && !!shop && purchaseBlockers.length === 0 && !!shopItem));

  const submit = () => {
    if (!canSubmit || !parsed.ok) return;
    if (mode === 'manual') {
      onQuick({
        teamId,
        mode,
        value: parsed.value,
        reason: reason.trim() || (parsed.value > 0 ? 'Cộng điểm thủ công' : 'Trừ điểm thủ công'),
      });
      return;
    }
    onPurchase({
      teamId,
      mode,
      value: quantity,
      reason: reason.trim() || (mode === 'piece' ? 'Mua mảnh ghép' : 'Mua vật phẩm'),
    });
  };

  const submitLabel =
    mode === 'manual'
      ? 'Ghi nhận điểm'
      : mode === 'piece'
        ? `Mua ${quantity} mảnh (−${totalCost} HH)`
        : `Mua ${quantity} vật phẩm (−${totalCost} HH)`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thao tác nhanh</CardTitle>
        <CardDescription>
          Cộng/trừ huy hiệu, hoặc mua mảnh ghép / vật phẩm theo rule snapshot của workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
          <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Loại thao tác">
            {(
              [
                ['manual', 'Cộng/trừ điểm', ArrowUpDown],
                ['piece', 'Mảnh ghép', Gem],
                ['item', 'Vật phẩm', Package],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                type="button"
                key={id}
                role="tab"
                aria-selected={mode === id}
                onClick={() => {
                  setMode(id);
                  setQuantity(1);
                }}
                className={cn(
                  'flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] border px-2 text-sm font-medium',
                  mode === id
                    ? 'border-[var(--border)] bg-[var(--muted)]'
                    : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50',
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
                {teams.map((item) => (
                  <option key={item.teamId} value={item.teamId}>
                    {item.displayName || item.name} · {item.medals} HH · {item.pieces} mảnh ·{' '}
                    {item.items} VP
                  </option>
                ))}
              </Select>
            </Field>

            {team && (
              <div
                className="grid grid-cols-3 gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-center text-sm"
                aria-label="Số dư đội đang chọn"
              >
                <div>
                  <div className="font-semibold tabular">{team.medals}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Huy hiệu</div>
                </div>
                <div>
                  <div className="font-semibold tabular">{team.pieces}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Mảnh ghép</div>
                </div>
                <div>
                  <div className="font-semibold tabular">{team.items}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Vật phẩm</div>
                </div>
              </div>
            )}

            {!shopReady && (mode === 'piece' || mode === 'item') && (
              <Alert variant="warning">Đang tải cấu hình shop từ ranking workspace…</Alert>
            )}
            {shopReady && !shop && (mode === 'piece' || mode === 'item') && (
              <Alert variant="destructive">
                Ranking không có shop snapshot. Thử tải lại trang hoặc kiểm tra API ranking.
              </Alert>
            )}

            {mode === 'piece' && shop && <PieceIntro shop={shop} team={team} />}
            {mode === 'item' && shop && <ItemIntro shop={shop} />}

            {mode === 'manual' ? (
              <>
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
                <Field label="Lý do / ghi chú" htmlFor="quick-reason">
                  <Input
                    id="quick-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Ghi chú (tuỳ chọn)"
                  />
                </Field>
              </>
            ) : (
              <PurchaseFields
                mode={mode}
                team={team}
                shopItem={shopItem}
                quantity={quantity}
                unitCost={unitCost}
                unitGain={unitGain}
                totalCost={totalCost}
                blockers={purchaseBlockers}
                onQuantity={setQuantity}
              />
            )}

            <Button
              type="button"
              loading={saving}
              disabled={!canSubmit}
              onClick={submit}
              data-testid="quick-submit"
            >
              {submitLabel}
            </Button>
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}

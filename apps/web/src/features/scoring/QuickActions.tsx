import { ArrowUpDown, Gem, Package } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('scoring');
  const { t: tc } = useTranslation('common');
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
    if (!shopReady || !shop) return [t('quick.shopLoading')] as string[];
    if (!team || !shopItem) return [t('quick.shopMissing')] as string[];
    const issues: string[] = [];
    if (quantity < 1) issues.push(t('quick.qtyMin'));
    if (team.medals < totalCost)
      issues.push(
        t('quick.notEnough', {
          need: totalCost,
          have: team.medals,
          missing: totalCost - team.medals,
        }),
      );
    if (mode === 'piece' && shop.pieceLimit?.active) {
      const bought = team.shopPiecesBought ?? 0;
      const remaining = Math.max(0, shop.pieceLimit.max - bought);
      if (bought + quantity > shop.pieceLimit.max)
        issues.push(
          t('quick.pieceLimit', {
            activity: shop.pieceLimit.activityKey,
            max: shop.pieceLimit.max,
            bought,
            remaining,
          }),
        );
    }
    return issues;
  }, [mode, shopReady, shop, team, shopItem, quantity, totalCost, t]);

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
        reason:
          reason.trim() || (parsed.value > 0 ? t('quick.defaultAdd') : t('quick.defaultSubtract')),
      });
      return;
    }
    onPurchase({
      teamId,
      mode,
      value: quantity,
      reason:
        reason.trim() ||
        (mode === 'piece' ? t('quick.defaultBuyPiece') : t('quick.defaultBuyItem')),
    });
  };

  const submitLabel =
    mode === 'manual'
      ? t('quick.submitManual')
      : mode === 'piece'
        ? t('quick.submitPiece', { count: quantity, cost: totalCost })
        : t('quick.submitItem', { count: quantity, cost: totalCost });

  const modeTabs = [
    ['manual', t('quick.manual'), ArrowUpDown],
    ['piece', t('quick.piece'), Gem],
    ['item', t('quick.item'), Package],
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('quick.title')}</CardTitle>
        <CardDescription>{t('quick.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
          <div className="grid grid-cols-3 gap-2" role="tablist" aria-label={t('quick.typeLabel')}>
            {modeTabs.map(([id, label, Icon]) => (
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
            <Field label={t('quick.team')} htmlFor="quick-team">
              <Select
                id="quick-team"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                {teams.map((item) => (
                  <option key={item.teamId} value={item.teamId}>
                    {t('quick.teamLine', {
                      name: item.displayName || item.name,
                      medals: item.medals,
                      pieces: item.pieces,
                      items: item.items,
                    })}
                  </option>
                ))}
              </Select>
            </Field>

            {team && (
              <div
                className="grid grid-cols-3 gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-center text-sm"
                aria-label={t('quick.teamBalance')}
              >
                <div>
                  <div className="font-semibold tabular">{team.medals}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {tc('metrics.medals')}
                  </div>
                </div>
                <div>
                  <div className="font-semibold tabular">{team.pieces}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {tc('metrics.pieces')}
                  </div>
                </div>
                <div>
                  <div className="font-semibold tabular">{team.items}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {tc('metrics.items')}
                  </div>
                </div>
              </div>
            )}

            {!shopReady && (mode === 'piece' || mode === 'item') && (
              <Alert variant="warning">{t('quick.shopLoadingAlert')}</Alert>
            )}
            {shopReady && !shop && (mode === 'piece' || mode === 'item') && (
              <Alert variant="destructive">{t('quick.shopMissingAlert')}</Alert>
            )}

            {mode === 'piece' && shop && <PieceIntro shop={shop} team={team} />}
            {mode === 'item' && shop && <ItemIntro shop={shop} />}

            {mode === 'manual' ? (
              <>
                <Field
                  label={t('quick.delta')}
                  htmlFor="quick-delta"
                  error={!parsed.ok ? parsed.error : undefined}
                  hint={t('quick.deltaHint')}
                >
                  <Input
                    id="quick-delta"
                    inputMode="text"
                    autoComplete="off"
                    placeholder={t('quick.deltaPlaceholder')}
                    value={deltaText}
                    onChange={(event) => setDeltaText(event.target.value)}
                    aria-invalid={!parsed.ok}
                  />
                </Field>
                <Field label={t('quick.reason')} htmlFor="quick-reason">
                  <Input
                    id="quick-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={t('quick.reasonPlaceholder')}
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

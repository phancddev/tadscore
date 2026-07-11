import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import type { ShopItem, Team } from '../../lib/types';
import type { ShopConfig } from './shopConfig';

export function PieceIntro({ shop, team }: { shop: ShopConfig; team?: Team }) {
  const { t } = useTranslation('scoring');
  const boughtPart =
    team && shop.pieceLimit
      ? t('shop.limitBoughtPart', {
          bought: team.shopPiecesBought ?? 0,
          remaining: Math.max(0, shop.pieceLimit.max - (team.shopPiecesBought ?? 0)),
        })
      : '';
  return (
    <Alert variant="default" className="flex-col items-stretch gap-2">
      <p className="m-0 text-sm font-medium">{t('shop.pieceTitle')}</p>
      <p className="m-0 text-sm text-[var(--muted-foreground)]">
        {t('shop.pieceDesc', { count: shop.minimumPieces })}
      </p>
      {team && (
        <div className="flex flex-wrap gap-2">
          <Badge tone={team.pieces >= shop.minimumPieces ? 'success' : 'warning'}>
            {team.pieces >= shop.minimumPieces
              ? t('shop.eligible', { current: team.pieces, min: shop.minimumPieces })
              : t('shop.missingPieces', {
                  count: Math.max(0, shop.minimumPieces - team.pieces),
                })}
          </Badge>
          {shop.piece && (
            <Badge tone="outline">
              {t('shop.pricePerPiece', {
                cost: shop.piece.medalCost,
                gain: shop.piece.pieceDelta,
              })}
            </Badge>
          )}
        </div>
      )}
      {shop.pieceLimit && (
        <p className="m-0 text-xs text-[var(--muted-foreground)]">
          {shop.pieceLimit.active
            ? t('shop.limitActive', {
                activity: shop.pieceLimit.activityKey,
                max: shop.pieceLimit.max,
                boughtPart,
              })
            : t('shop.limitInactive', { activity: shop.pieceLimit.activityKey })}
        </p>
      )}
    </Alert>
  );
}

export function ItemIntro({ shop }: { shop: ShopConfig }) {
  const { t } = useTranslation('scoring');
  return (
    <Alert variant="default" className="flex-col items-stretch gap-2">
      <p className="m-0 text-sm font-medium">{t('shop.itemTitle')}</p>
      <p className="m-0 text-sm text-[var(--muted-foreground)]">{t('shop.itemDesc')}</p>
      {shop.item && (
        <Badge tone="outline" className="w-fit">
          {t('shop.pricePerItem', {
            cost: shop.item.medalCost,
            gain: shop.item.itemDelta,
          })}
        </Badge>
      )}
    </Alert>
  );
}

export function PurchaseFields({
  mode,
  team,
  shopItem,
  quantity,
  unitCost,
  unitGain,
  totalCost,
  blockers,
  onQuantity,
}: {
  mode: 'piece' | 'item';
  team?: Team;
  shopItem?: ShopItem;
  quantity: number;
  unitCost: number;
  unitGain: number;
  totalCost: number;
  blockers: string[];
  onQuantity: (value: number) => void;
}) {
  const { t } = useTranslation('scoring');
  return (
    <>
      <Field
        label={t('quick.quantity')}
        htmlFor="quick-value"
        hint={
          shopItem
            ? t('quick.unitHint', {
                cost: unitCost,
                gain: unitGain,
                unit: mode === 'piece' ? t('quick.unitPiece') : t('quick.unitItem'),
              })
            : undefined
        }
      >
        <Input
          id="quick-value"
          type="number"
          min={1}
          max={100}
          value={quantity}
          onChange={(event) =>
            onQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))
          }
        />
      </Field>
      {shopItem && team && (
        <div className="rounded-[var(--radius)] border border-[var(--border)] p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-[var(--muted-foreground)]">{t('quick.totalMedalCost')}</span>
            <strong className="tabular text-[var(--destructive)]">−{totalCost} HH</strong>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-[var(--muted-foreground)]">
              {mode === 'piece' ? t('quick.afterPieces') : t('quick.afterItems')}
            </span>
            <strong className="tabular">
              {mode === 'piece'
                ? `${team.pieces} → ${team.pieces + unitGain * quantity}`
                : `${team.items} → ${team.items + unitGain * quantity}`}
            </strong>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-[var(--muted-foreground)]">{t('quick.afterMedals')}</span>
            <strong className="tabular">
              {team.medals} → {team.medals - totalCost}
            </strong>
          </div>
        </div>
      )}
      {blockers.map((issue) => (
        <Alert key={issue} variant="warning">
          {issue}
        </Alert>
      ))}
    </>
  );
}

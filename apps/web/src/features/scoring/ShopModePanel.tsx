import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import type { ShopItem, Team } from '../../lib/types';
import type { ShopConfig } from './shopConfig';

export function PieceIntro({ shop, team }: { shop: ShopConfig; team?: Team }) {
  return (
    <Alert variant="default" className="flex-col items-stretch gap-2">
      <p className="m-0 text-sm font-medium">Mảnh ghép = điều kiện xếp hạng</p>
      <p className="m-0 text-sm text-[var(--muted-foreground)]">
        Cần tối thiểu <strong>{shop.minimumPieces} mảnh</strong> để xếp trước đội chưa đủ. Shop đổi
        huy hiệu lấy mảnh, không phải điểm thưởng game.
      </p>
      {team && (
        <div className="flex flex-wrap gap-2">
          <Badge tone={team.pieces >= shop.minimumPieces ? 'success' : 'warning'}>
            {team.pieces >= shop.minimumPieces
              ? `Đủ điều kiện (${team.pieces}/${shop.minimumPieces})`
              : `Còn thiếu ${Math.max(0, shop.minimumPieces - team.pieces)} mảnh`}
          </Badge>
          {shop.piece && (
            <Badge tone="outline">
              Giá: {shop.piece.medalCost} HH / {shop.piece.pieceDelta} mảnh
            </Badge>
          )}
        </div>
      )}
      {shop.pieceLimit && (
        <p className="m-0 text-xs text-[var(--muted-foreground)]">
          {shop.pieceLimit.active ? (
            <>
              Limit đang áp dụng: trước khi{' '}
              <code className="rounded bg-[var(--muted)] px-1">{shop.pieceLimit.activityKey}</code>{' '}
              xong, mỗi đội tối đa <strong>{shop.pieceLimit.max}</strong> mảnh từ shop
              {team
                ? ` (đã mua ${team.shopPiecesBought ?? 0}, còn ${Math.max(0, shop.pieceLimit.max - (team.shopPiecesBought ?? 0))})`
                : ''}
              .
            </>
          ) : (
            <>
              Limit shop theo{' '}
              <code className="rounded bg-[var(--muted)] px-1">{shop.pieceLimit.activityKey}</code>{' '}
              đã hết hiệu lực (activity finalized) — mua thêm không bị chặn max shop.
            </>
          )}
        </p>
      )}
    </Alert>
  );
}

export function ItemIntro({ shop }: { shop: ShopConfig }) {
  return (
    <Alert variant="default" className="flex-col items-stretch gap-2">
      <p className="m-0 text-sm font-medium">Vật phẩm cửa hàng</p>
      <p className="m-0 text-sm text-[var(--muted-foreground)]">
        Mua bằng huy hiệu. Không dùng để tính đủ điều kiện như mảnh ghép.
      </p>
      {shop.item && (
        <Badge tone="outline" className="w-fit">
          Giá: {shop.item.medalCost} HH / {shop.item.itemDelta} vật phẩm
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
  return (
    <>
      <Field
        label="Số lượng"
        htmlFor="quick-value"
        hint={
          shopItem
            ? `Mỗi đơn vị: −${unitCost} HH, +${unitGain} ${mode === 'piece' ? 'mảnh' : 'vật phẩm'}`
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
            <span className="text-[var(--muted-foreground)]">Tổng trừ huy hiệu</span>
            <strong className="tabular text-[var(--destructive)]">−{totalCost} HH</strong>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-[var(--muted-foreground)]">
              {mode === 'piece' ? 'Mảnh sau mua' : 'Vật phẩm sau mua'}
            </span>
            <strong className="tabular">
              {mode === 'piece'
                ? `${team.pieces} → ${team.pieces + unitGain * quantity}`
                : `${team.items} → ${team.items + unitGain * quantity}`}
            </strong>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-[var(--muted-foreground)]">Huy hiệu sau mua</span>
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

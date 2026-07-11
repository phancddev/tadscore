import type { Ranking, ShopItem } from '../../lib/types';

export type ShopConfig = {
  piece?: ShopItem;
  item?: ShopItem;
  minimumPieces: number;
  pieceLimit?: {
    activityKey: string;
    max: number;
    /** When true, backend still enforces max total shop piece purchases. */
    active: boolean;
  };
};

/** Build shop UI config from ranking payload (workspace rule_snapshot). */
export function shopConfigFromRanking(ranking?: Ranking | null): ShopConfig | null {
  if (!ranking?.shop) return null;
  const shop = ranking.shop;
  return {
    piece: shop.piece,
    item: shop.item,
    minimumPieces: shop.minimumPieces ?? ranking.rule.minimumPieces,
    pieceLimit: shop.pieceLimit
      ? {
          activityKey: shop.pieceLimit.activityKey,
          max: shop.pieceLimit.max,
          active: shop.pieceLimit.active,
        }
      : undefined,
  };
}

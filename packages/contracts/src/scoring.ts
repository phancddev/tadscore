import { z } from 'zod';
import { idempotencySchema, slugSchema, uuidSchema } from './common.js';

export const submitGameSchema = z.object({
  activityKey: z.string().min(1).max(100),
  idempotencyKey: idempotencySchema,
  notes: z.string().max(1000).optional(),
  results: z
    .array(z.object({ teamId: uuidSchema, rank: z.number().int().positive() }))
    .min(2)
    .max(32),
});
/** Replace ranks on a finalized game: reverse prior awards then submit new ones (one transaction). */
export const replaceGameSchema = submitGameSchema.extend({
  reason: z.string().trim().min(2).max(500),
});
export const adjustmentSchema = z.object({
  teamId: uuidSchema,
  kind: z.enum(['speech', 'violation', 'manual']),
  medalDelta: z
    .number()
    .int()
    .min(-100000)
    .max(100000)
    .refine((value) => value !== 0, 'Adjustment cannot be zero'),
  reason: z.string().trim().min(2).max(500),
  idempotencyKey: idempotencySchema,
});
export const purchaseSchema = z.object({
  teamId: uuidSchema,
  itemKey: z.enum(['piece', 'item']),
  quantity: z.number().int().min(1).max(100),
  idempotencyKey: idempotencySchema,
});
export const reversalSchema = z.object({
  reason: z.string().trim().min(2).max(500),
  idempotencyKey: idempotencySchema,
});
/** In-place edit of adjustment/penalty reason and medal delta (not score history rewrite via reversal). */
export const updateLedgerEntrySchema = z.object({
  medalDelta: z
    .number()
    .int()
    .min(-100000)
    .max(100000)
    .refine((value) => value !== 0, 'Adjustment cannot be zero'),
  reason: z.string().trim().min(2).max(500),
});

export const createPublicLinkSchema = z.object({
  slug: slugSchema.optional(),
  label: z.string().trim().max(100).optional(),
  expiresInHours: z.number().int().min(1).max(8760).optional(),
  /** When set, applies to both token and slug paths (create defaults). */
  isEnabled: z.boolean().optional(),
  tokenEnabled: z.boolean().optional(),
  slugEnabled: z.boolean().optional(),
});
export const updatePublicLinkSchema = z
  .object({
    slug: slugSchema.nullable().optional(),
    label: z.string().trim().max(100).nullable().optional(),
    /** Convenience: set both tokenEnabled and slugEnabled. */
    isEnabled: z.boolean().optional(),
    tokenEnabled: z.boolean().optional(),
    slugEnabled: z.boolean().optional(),
    expiresInHours: z.number().int().min(1).max(8760).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export function validateRankPermutation(ranks: number[], teamCount: number): boolean {
  return (
    ranks.length === teamCount &&
    [...ranks].sort((a, b) => a - b).every((rank, index) => rank === index + 1)
  );
}

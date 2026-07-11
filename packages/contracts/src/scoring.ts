import { z } from 'zod';
import { idempotencySchema, uuidSchema } from './common.js';

export const submitGameSchema = z.object({
  activityKey: z.string().min(1).max(100),
  idempotencyKey: idempotencySchema,
  notes: z.string().max(1000).optional(),
  results: z
    .array(z.object({ teamId: uuidSchema, rank: z.number().int().positive() }))
    .min(2)
    .max(32),
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
export const createPublicLinkSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{2,79}$/)
    .optional(),
  label: z.string().max(100).optional(),
  expiresInHours: z.number().int().min(1).max(8760).optional(),
});

export function validateRankPermutation(ranks: number[], teamCount: number): boolean {
  return (
    ranks.length === teamCount &&
    [...ranks].sort((a, b) => a - b).every((rank, index) => rank === index + 1)
  );
}

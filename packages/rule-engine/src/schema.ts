import { z } from 'zod';

export const activityRuleSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['ranked_game', 'manual']),
  sequence: z.number().int().positive(),
  medalAwards: z.array(z.number().int()).optional(),
  pieceAwards: z.array(z.number().int()).optional(),
  phase: z.string().min(1),
});
export const ruleDefinitionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.string().min(1),
    name: z.string().min(1),
    teamCount: z.number().int().min(2).max(32),
    activities: z.array(activityRuleSchema).min(1),
    adjustments: z.object({ speech: z.number().int(), violations: z.array(z.number().int()) }),
    shop: z.record(
      z.string(),
      z.object({
        medalCost: z.number().int().nonnegative(),
        medalDelta: z.number().int(),
        pieceDelta: z.number().int(),
        itemDelta: z.number().int(),
      }),
    ),
    constraints: z.object({
      purchasePieceLimitBeforeActivity: z.object({
        activityKey: z.string(),
        max: z.number().int().nonnegative(),
      }),
    }),
    ranking: z.object({
      minimumPieces: z.number().int().nonnegative(),
      ineligibleSort: z.literal('pieces_then_medals'),
      tieBreak: z.literal('name_then_id'),
    }),
    assumptions: z.array(z.string()),
  })
  .superRefine((rule, ctx) => {
    const keys = rule.activities.map((a) => a.key);
    const sequences = rule.activities.map((a) => a.sequence);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: 'custom', message: 'Activity keys must be unique' });
    if (new Set(sequences).size !== sequences.length)
      ctx.addIssue({ code: 'custom', message: 'Activity sequences must be unique' });
    for (const activity of rule.activities.filter((a) => a.type === 'ranked_game')) {
      if (activity.medalAwards?.length !== rule.teamCount)
        ctx.addIssue({
          code: 'custom',
          message: `${activity.key} medal awards must match teamCount`,
        });
      if (activity.pieceAwards && activity.pieceAwards.length !== rule.teamCount)
        ctx.addIssue({
          code: 'custom',
          message: `${activity.key} piece awards must match teamCount`,
        });
    }
    for (const activity of rule.activities.filter((a) => a.type === 'manual')) {
      if (activity.medalAwards || activity.pieceAwards)
        ctx.addIssue({
          code: 'custom',
          message: `${activity.key} manual activities cannot define rank awards`,
        });
    }
    if (!keys.includes(rule.constraints.purchasePieceLimitBeforeActivity.activityKey))
      ctx.addIssue({ code: 'custom', message: 'Purchase phase activity does not exist' });
    if (rule.adjustments.violations.some((value) => value >= 0))
      ctx.addIssue({ code: 'custom', message: 'Violations must be negative' });
    for (const [key, item] of Object.entries(rule.shop)) {
      const inventoryDelta = item.pieceDelta + item.itemDelta;
      if (
        item.medalDelta !== -item.medalCost ||
        item.pieceDelta < 0 ||
        item.itemDelta < 0 ||
        inventoryDelta <= 0
      ) {
        ctx.addIssue({ code: 'custom', message: `Shop item ${key} has incoherent deltas` });
      }
    }
  });
export type RuleDefinition = z.infer<typeof ruleDefinitionSchema>;
export type ActivityRule = z.infer<typeof activityRuleSchema>;

export interface TeamBalance {
  teamId: string;
  name: string;
  medals: number;
  pieces: number;
  items: number;
}
export interface RankedTeam extends TeamBalance {
  rank: number;
  eligible: boolean;
}

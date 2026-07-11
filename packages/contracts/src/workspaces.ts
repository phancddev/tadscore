import { z } from 'zod';
import { emailSchema, slugSchema, uuidSchema, workspaceRoleSchema } from './common.js';

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: slugSchema,
  description: z.string().trim().max(2000).optional(),
  ruleId: z.string().min(1).max(100),
  ruleVersion: z.string().min(1).max(40),
});
export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['active', 'locked', 'archived', 'suspended']).optional(),
});
export const createInvitationSchema = z
  .object({
    kind: z.enum(['email', 'share_link']),
    email: emailSchema.optional(),
    role: workspaceRoleSchema.exclude(['owner']),
    expiresInHours: z.number().int().min(1).max(720).default(72),
    maxUses: z.number().int().min(1).max(100).default(1),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'email' && !v.email)
      ctx.addIssue({ code: 'custom', message: 'Email is required' });
    if (v.kind === 'share_link' && v.email)
      ctx.addIssue({ code: 'custom', message: 'Share links cannot target an email' });
  });
export const updateMemberSchema = z.object({ role: workspaceRoleSchema.exclude(['owner']) });
export const teamSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(120),
  color: z.string().max(20).optional(),
  icon: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).max(100).default(0),
});
export const workspaceIdParams = z.object({ workspaceId: uuidSchema });

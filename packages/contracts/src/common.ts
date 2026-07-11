import { z } from 'zod';

export const uuidSchema = z.uuid();
export const globalRoleSchema = z.enum(['super_admin', 'user']);
export const userStatusSchema = z.enum(['pending', 'active', 'suspended']);
export const workspaceStatusSchema = z.enum(['active', 'locked', 'suspended', 'archived']);
export const workspaceRoleSchema = z.enum(['owner', 'admin', 'scorer', 'viewer']);
export const emailSchema = z
  .email()
  .max(320)
  .transform((value) => value.trim().toLowerCase());
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_.-]{2,31}$/);
export const passwordSchema = z.string().min(10).max(128);
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{2,79}$/);
export const idempotencySchema = z.string().trim().min(8).max(120);

export type GlobalRole = z.infer<typeof globalRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type WorkspaceStatus = z.infer<typeof workspaceStatusSchema>;
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
export interface ApiSuccess<T> {
  data: T;
}

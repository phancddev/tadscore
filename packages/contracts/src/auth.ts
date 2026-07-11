import { z } from 'zod';
import { emailSchema, passwordSchema, usernameSchema } from './common.js';

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  fullName: z.string().trim().min(1).max(160),
  password: passwordSchema,
});
export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(320),
  password: z.string().min(1).max(128),
});
export const verifySchema = z
  .object({
    email: emailSchema.optional(),
    code: z
      .string()
      .regex(/^\d{6,10}$/)
      .optional(),
    token: z.string().min(32).optional(),
  })
  .refine((v) => Boolean(v.code) !== Boolean(v.token), 'Provide code or token')
  .refine((v) => !v.code || Boolean(v.email), 'Email is required with a code');
export const emailOnlySchema = z.object({ email: emailSchema });
export const resetPasswordSchema = verifySchema.extend({ password: passwordSchema });
export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(160).optional(),
    username: usernameSchema.optional(),
    email: emailSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'No changes supplied');
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
  logoutOthers: z.boolean().default(true),
});

export type RegisterInput = z.infer<typeof registerSchema>;

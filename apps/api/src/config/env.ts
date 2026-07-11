import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(1108),
  DATABASE_URL: z.string().default('postgres://tadscore:tadscore@postgres:5432/tadscore'),
  WEB_ORIGIN: z.string().default('http://localhost:1107'),
  RULE_CONFIG_PATH: z.string().default('/app/rule-config'),
  UPLOAD_DIR: z.string().default('/data/uploads'),
  SESSION_COOKIE_NAME: z.string().default('tadscore_session'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  COOKIE_SECURE: bool,
  AUTH_EMAIL_VERIFICATION_MODE: z.enum(['off', 'otp', 'link']).default('otp'),
  AUTH_OTP_LENGTH: z.coerce.number().int().min(6).max(10).default(6),
  AUTH_OTP_TTL_SECONDS: z.coerce.number().int().min(60).default(86400),
  AUTH_OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  AUTH_OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(300),
  AUTH_OTP_MAX_SENDS: z.coerce.number().int().min(1).default(5),
  AUTH_OTP_SEND_WINDOW_SECONDS: z.coerce.number().int().positive().default(86400),
  AUTH_OTP_LOCK_SECONDS: z.coerce.number().int().positive().default(18000),
  AUTH_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(10),
  AUTH_LOGIN_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
  AUTH_LOGIN_LOCK_SECONDS: z.coerce.number().int().positive().default(900),
  SMTP_HOST: z.string().default('mailpit'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('TadScore <noreply@tadscore.local>'),
  MAX_AVATAR_BYTES: z.coerce.number().int().min(100_000).max(20_000_000).default(5_242_880),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;
export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
export function resetEnvForTest() {
  cached = undefined;
}

import type { FastifyInstance } from 'fastify';
import {
  changePasswordSchema,
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifySchema,
} from '@tadscore/contracts';
import { env } from '../../config/env.js';
import { one, pool, transaction } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { camelize } from '../../lib/dto.js';
import { queueEmail } from '../../lib/outbox.js';
import { clearLimit, consumeLimit } from '../../lib/rate-limit.js';
import { hashPassword, hashToken, randomToken, verifyPassword } from '../../lib/security.js';
import { authenticate, setSessionCookie } from './guards.js';
import { consumeVerification, issueVerification } from './verification.js';

const publicUser = (row: Record<string, unknown>) => ({
  id: row.id,
  email: row.email,
  username: row.username,
  fullName: row.full_name,
  globalRole: row.global_role,
  status: row.status,
  avatarUrl: row.avatar_path ? '/uploads/' + row.avatar_path : null,
  emailVerifiedAt: row.email_verified_at,
});

export async function authRoutes(app: FastifyInstance) {
  app.get('/config', async () => ({
    data: {
      emailVerificationMode: env().AUTH_EMAIL_VERIFICATION_MODE,
      recoveryVerificationMode: env().AUTH_EMAIL_VERIFICATION_MODE === 'link' ? 'link' : 'otp',
      otpResendCooldownSeconds: env().AUTH_OTP_RESEND_COOLDOWN_SECONDS,
      registrationEnabled: true,
    },
  }));
  app.post('/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const result = await transaction(async (client) => {
      await consumeLimit(client, 'register', `${request.ip}:${input.email}`, 5, 3600, 3600);
      const mode = env().AUTH_EMAIL_VERIFICATION_MODE;
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO users(email,username,full_name,password_hash,status,email_verified_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          input.email,
          input.username,
          input.fullName,
          await hashPassword(input.password),
          mode === 'off' ? 'active' : 'pending',
          mode === 'off' ? new Date() : null,
        ],
      );
      const user = inserted.rows[0]!;
      if (mode !== 'off')
        await issueVerification(client, String(user.id), input.email, 'registration');
      return publicUser(user);
    });
    await audit(request, 'auth.register', 'user', String(result.id), {
      after: { email: result.email },
    });
    return reply.status(201).send({
      data: {
        user: result,
        verificationRequired: env().AUTH_EMAIL_VERIFICATION_MODE !== 'off',
        verificationMode: env().AUTH_EMAIL_VERIFICATION_MODE,
      },
    });
  });

  app.post('/verify', async (request, reply) => {
    const input = verifySchema.parse(request.body);
    const verified = await transaction(async (client) => {
      const verification = await consumeVerification(client, 'registration', input);
      if (!verification) return false;
      await client.query(
        "UPDATE users SET status='active',email_verified_at=now() WHERE id=$1 AND status='pending'",
        [verification.user_id],
      );
      return true;
    });
    if (!verified)
      throw new ApiError(400, 'INVALID_VERIFICATION', 'The verification code or token is invalid');
    return reply.send({ data: { verified: true } });
  });

  app.post('/resend', async (request, reply) => {
    const { email } = emailOnlySchema.parse(request.body);
    const user = await one<{ id: string; status: string }>(
      'SELECT id,status FROM users WHERE email=$1',
      [email],
    );
    if (user?.status === 'pending' && env().AUTH_EMAIL_VERIFICATION_MODE !== 'off')
      await transaction((client) => issueVerification(client, user.id, email, 'registration'));
    return reply.send({
      data: { message: 'If the account is eligible, a verification message has been queued' },
    });
  });

  app.post('/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const identifier = input.identifier.toLowerCase();
    await consumeLimit(
      pool,
      'login',
      `${request.ip}:${identifier}`,
      env().AUTH_LOGIN_MAX_ATTEMPTS,
      env().AUTH_LOGIN_WINDOW_SECONDS,
      env().AUTH_LOGIN_LOCK_SECONDS,
    );
    const user = await one<Record<string, unknown>>(
      'SELECT * FROM users WHERE email=$1 OR username=$1',
      [identifier],
    );
    if (
      !user ||
      !(await verifyPassword(String(user.password_hash), input.password)) ||
      user.status !== 'active'
    )
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email/username or password');
    await clearLimit(pool, 'login', `${request.ip}:${identifier}`);
    const token = randomToken();
    await pool.query(
      `INSERT INTO auth_sessions(user_id,token_hash,expires_at,ip_address,user_agent) VALUES($1,$2,now()+($3*interval '1 second'),$4,$5)`,
      [
        user.id,
        hashToken(token),
        env().SESSION_TTL_SECONDS,
        request.ip,
        request.headers['user-agent'] ?? null,
      ],
    );
    setSessionCookie(reply, token);
    await audit(request, 'auth.login', 'user', String(user.id));
    return reply.send({ data: { user: publicUser(user) } });
  });

  app.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    const token = request.cookies[env().SESSION_COOKIE_NAME]!;
    await pool.query('UPDATE auth_sessions SET revoked_at=now() WHERE token_hash=$1', [
      hashToken(token),
    ]);
    reply.clearCookie(env().SESSION_COOKIE_NAME, { path: '/' });
    await audit(request, 'auth.logout', 'user', request.user!.id);
    return reply.send({ data: { loggedOut: true } });
  });

  app.get('/me', { preHandler: authenticate }, async (request) => {
    const user = await one<Record<string, unknown>>(
      'SELECT id,email,username,full_name,global_role,status,avatar_path,pending_email,email_verified_at FROM users WHERE id=$1',
      [request.user!.id],
    );
    return { data: { user: { ...publicUser(user!), pendingEmail: user?.pending_email ?? null } } };
  });
  app.post('/forgot-password', async (request, reply) => {
    const { email } = emailOnlySchema.parse(request.body);
    const user = await one<{ id: string }>(
      "SELECT id FROM users WHERE email=$1 AND status='active'",
      [email],
    );
    if (user)
      await transaction((client) => issueVerification(client, user.id, email, 'password_reset'));
    return reply.send({
      data: { message: 'If the account exists, reset instructions have been queued' },
    });
  });
  app.post('/reset-password', async (request, reply) => {
    const input = resetPasswordSchema.parse(request.body);
    const reset = await transaction(async (client) => {
      const verification = await consumeVerification(client, 'password_reset', input);
      if (!verification?.user_id) return false;
      await client.query(
        'UPDATE users SET password_hash=$1,password_changed_at=now() WHERE id=$2',
        [await hashPassword(input.password), verification.user_id],
      );
      await client.query(
        'UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',
        [verification.user_id],
      );
      return true;
    });
    if (!reset) throw new ApiError(400, 'INVALID_VERIFICATION', 'Invalid reset request');
    return reply.send({ data: { reset: true } });
  });

  app.patch('/profile', { preHandler: authenticate }, async (request, reply) => {
    const input = updateProfileSchema.parse(request.body);
    const current = await one<Record<string, unknown>>(
      'SELECT id,email,username,full_name,pending_email,email_verified_at,avatar_path FROM users WHERE id=$1',
      [request.user!.id],
    );
    if (input.email && input.email !== current?.email) {
      await transaction(async (client) => {
        await client.query('UPDATE users SET pending_email=$1 WHERE id=$2', [
          input.email,
          request.user!.id,
        ]);
        await issueVerification(client, request.user!.id, input.email!, 'email_change');
      });
    }
    const updated = await one<Record<string, unknown>>(
      'UPDATE users SET full_name=COALESCE($1,full_name),username=COALESCE($2,username) WHERE id=$3 RETURNING id,email,username,full_name,global_role,status,pending_email,email_verified_at,avatar_path',
      [input.fullName ?? null, input.username ?? null, request.user!.id],
    );
    await audit(request, 'profile.update', 'user', request.user!.id, {
      before: camelize(current ?? {}),
      after: camelize(updated ?? {}),
    });
    return reply.send({
      data: {
        user: publicUser(updated!),
        emailVerificationPending: Boolean(input.email && input.email !== current?.email),
      },
    });
  });
  app.post('/profile/verify-email', { preHandler: authenticate }, async (request, reply) => {
    const input = verifySchema.parse(request.body);
    const changed = await transaction(async (client) => {
      const verification = await consumeVerification(
        client,
        'email_change',
        input,
        request.user!.id,
      );
      if (!verification) return false;
      const old = request.user!.email;
      await client.query(
        'UPDATE users SET email=pending_email,pending_email=NULL,email_verified_at=now() WHERE id=$1 AND pending_email=$2',
        [request.user!.id, verification.destination],
      );
      await queueEmail(client, old, 'email_changed', {});
      return true;
    });
    if (!changed) throw new ApiError(400, 'INVALID_VERIFICATION', 'Invalid email verification');
    await audit(request, 'profile.email.change', 'user', request.user!.id);
    return reply.send({ data: { changed: true } });
  });

  app.post('/password', { preHandler: authenticate }, async (request, reply) => {
    const input = changePasswordSchema.parse(request.body);
    const current = await one<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id=$1',
      [request.user!.id],
    );
    if (!current || !(await verifyPassword(current.password_hash, input.currentPassword)))
      throw new ApiError(400, 'INVALID_PASSWORD', 'Current password is incorrect');
    await transaction(async (client) => {
      await client.query(
        'UPDATE users SET password_hash=$1,password_changed_at=now() WHERE id=$2',
        [await hashPassword(input.newPassword), request.user!.id],
      );
      if (input.logoutOthers) {
        const token = request.cookies[env().SESSION_COOKIE_NAME]!;
        await client.query(
          'UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND token_hash<>$2 AND revoked_at IS NULL',
          [request.user!.id, hashToken(token)],
        );
      }
    });
    await audit(request, 'profile.password.change', 'user', request.user!.id);
    return reply.send({ data: { changed: true } });
  });
}

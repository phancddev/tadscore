import type { DbClient } from '../../lib/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';
import { queueEmail } from '../../lib/outbox.js';
import { consumeLimit } from '../../lib/rate-limit.js';
import {
  hashPassword,
  hashToken,
  randomOtp,
  randomToken,
  verifyPassword,
} from '../../lib/security.js';

type Purpose = 'registration' | 'email_change' | 'password_reset';
export async function issueVerification(
  client: DbClient,
  userId: string | null,
  destination: string,
  purpose: Purpose,
) {
  const config = env();
  await consumeLimit(
    client,
    `verification:${purpose}`,
    destination,
    config.AUTH_OTP_MAX_SENDS,
    config.AUTH_OTP_SEND_WINDOW_SECONDS,
    config.AUTH_OTP_LOCK_SECONDS,
  );
  const latest = await client.query<{ last_sent_at: Date }>(
    'SELECT last_sent_at FROM email_verifications WHERE destination=$1 AND purpose=$2 ORDER BY created_at DESC LIMIT 1',
    [destination, purpose],
  );
  const sent = latest.rows[0]?.last_sent_at;
  if (sent && Date.now() - sent.getTime() < config.AUTH_OTP_RESEND_COOLDOWN_SECONDS * 1000)
    throw new ApiError(429, 'RESEND_COOLDOWN', 'Please wait before requesting another code');
  await client.query(
    'UPDATE email_verifications SET consumed_at=now() WHERE destination=$1 AND purpose=$2 AND consumed_at IS NULL',
    [destination, purpose],
  );
  const ttl = config.AUTH_OTP_TTL_SECONDS;
  const deliveryMode = config.AUTH_EMAIL_VERIFICATION_MODE === 'link' ? 'link' : 'otp';
  if (deliveryMode === 'link') {
    const token = randomToken();
    await client.query(
      `INSERT INTO email_verifications(user_id,purpose,destination,token_hash,max_attempts,expires_at) VALUES($1,$2,$3,$4,$5,now()+($6*interval '1 second'))`,
      [userId, purpose, destination, hashToken(token), config.AUTH_OTP_MAX_ATTEMPTS, ttl],
    );
    await queueEmail(
      client,
      destination,
      purpose === 'password_reset' ? 'password_reset_link' : 'verify_link',
      { token },
    );
    return;
  }
  const code = randomOtp(config.AUTH_OTP_LENGTH);
  await client.query(
    `INSERT INTO email_verifications(user_id,purpose,destination,code_hash,max_attempts,expires_at) VALUES($1,$2,$3,$4,$5,now()+($6*interval '1 second'))`,
    [userId, purpose, destination, await hashPassword(code), config.AUTH_OTP_MAX_ATTEMPTS, ttl],
  );
  await queueEmail(
    client,
    destination,
    purpose === 'password_reset' ? 'password_reset_otp' : 'verify_otp',
    { code },
  );
}

export async function consumeVerification(
  client: DbClient,
  purpose: Purpose,
  input: { email?: string; code?: string; token?: string },
  expectedUserId?: string,
) {
  const found = input.token
    ? await client.query<{
        id: string;
        user_id: string | null;
        destination: string;
        code_hash: string | null;
        attempt_count: number;
        max_attempts: number;
      }>(
        `SELECT id,user_id,destination,code_hash,attempt_count,max_attempts FROM email_verifications WHERE token_hash=$1 AND purpose=$2 AND ($3::uuid IS NULL OR user_id=$3) AND consumed_at IS NULL AND expires_at>now() FOR UPDATE`,
        [hashToken(input.token), purpose, expectedUserId ?? null],
      )
    : await client.query<{
        id: string;
        user_id: string | null;
        destination: string;
        code_hash: string | null;
        attempt_count: number;
        max_attempts: number;
      }>(
        `SELECT id,user_id,destination,code_hash,attempt_count,max_attempts FROM email_verifications WHERE destination=$1 AND purpose=$2 AND ($3::uuid IS NULL OR user_id=$3) AND consumed_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [input.email, purpose, expectedUserId ?? null],
      );
  const row = found.rows[0];
  if (!row || row.attempt_count >= row.max_attempts)
    throw new ApiError(400, 'INVALID_VERIFICATION', 'The verification code or token is invalid');
  if (input.code && (!row.code_hash || !(await verifyPassword(row.code_hash, input.code)))) {
    await client.query('UPDATE email_verifications SET attempt_count=attempt_count+1 WHERE id=$1', [
      row.id,
    ]);
    return undefined;
  }
  await client.query('UPDATE email_verifications SET consumed_at=now() WHERE id=$1', [row.id]);
  return row;
}

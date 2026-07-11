import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { pool, type DbClient } from './db.js';

type Template =
  | 'verify_otp'
  | 'verify_link'
  | 'password_reset_otp'
  | 'password_reset_link'
  | 'email_changed'
  | 'workspace_invite';
export async function queueEmail(
  client: DbClient,
  to: string,
  template: Template,
  payload: Record<string, unknown>,
) {
  await client.query('INSERT INTO email_outbox(to_email,template,payload) VALUES($1,$2,$3)', [
    to,
    template,
    payload,
  ]);
}
function render(template: string, payload: Record<string, unknown>) {
  const app = env().WEB_ORIGIN;
  const map: Record<string, [string, string]> = {
    verify_otp: ['Verify your TadScore account', `Your verification code is ${payload.code}.`],
    verify_link: ['Verify your TadScore account', `Verify: ${app}/verify?token=${payload.token}`],
    password_reset_otp: [
      'Reset your TadScore password',
      `Your password reset code is ${payload.code}.`,
    ],
    password_reset_link: [
      'Reset your TadScore password',
      `Reset: ${app}/reset-password?token=${payload.token}`,
    ],
    email_changed: [
      'Your TadScore email changed',
      'Your account email address was changed. Contact an administrator if this was not you.',
    ],
    workspace_invite: [
      'TadScore workspace invitation',
      `Join the workspace: ${app}/invite/${payload.token}`,
    ],
  };
  return map[template] ?? ['TadScore notification', JSON.stringify(payload)];
}

export async function processOutboxBatch() {
  const config = env();
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query<{
      id: string;
      to_email: string;
      template: string;
      payload: Record<string, unknown>;
    }>(
      `SELECT id,to_email,template,payload FROM email_outbox WHERE status IN ('pending','failed') AND next_attempt_at<=now() AND attempt_count<max_attempts ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20`,
    );
    for (const item of selected.rows) {
      try {
        const [subject, text] = render(item.template, item.payload);
        await transport.sendMail({ from: config.SMTP_FROM, to: item.to_email, subject, text });
        await client.query(
          "UPDATE email_outbox SET status='sent',sent_at=now(),attempt_count=attempt_count+1,last_error=NULL WHERE id=$1",
          [item.id],
        );
      } catch (error) {
        await client.query(
          "UPDATE email_outbox SET status='failed',attempt_count=attempt_count+1,next_attempt_at=now()+interval '5 minutes',last_error=$2 WHERE id=$1",
          [item.id, String(error).slice(0, 2000)],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

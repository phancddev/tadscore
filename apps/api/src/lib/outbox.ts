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

type RenderedEmail = { subject: string; text: string; html?: string };

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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inviteButtonHtml(url: string, label: string) {
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.2">${escapeHtml(label)}</a>`;
}

function render(template: string, payload: Record<string, unknown>): RenderedEmail {
  const app = env().WEB_ORIGIN.split(',')[0]?.trim() || env().WEB_ORIGIN;
  if (template === 'workspace_invite') {
    const inviterName = String(payload.inviterFullName || 'Someone').trim() || 'Someone';
    const workspaceName = String(payload.workspaceName || 'a workspace').trim() || 'a workspace';
    const roleKey = String(payload.role || 'viewer').toLowerCase();
    const roleLabel =
      ({ admin: 'Admin', scorer: 'Scorer', viewer: 'Viewer' } as Record<string, string>)[roleKey] ||
      'Viewer';
    const joinUrl = `${app}/invite/${payload.token}`;
    const subject = `${inviterName} invited you to ${workspaceName} as ${roleLabel}`;
    const text = [
      `${inviterName} invited you to ${workspaceName} as ${roleLabel}.`,
      '',
      `Join workspace: ${joinUrl}`,
    ].join('\n');
    const html = [
      '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111827">',
      `<p style="margin:0 0 16px"><strong>${escapeHtml(inviterName)}</strong> invited you to <strong>${escapeHtml(workspaceName)}</strong> as <strong>${escapeHtml(roleLabel)}</strong>.</p>`,
      `<p style="margin:0 0 20px">${inviteButtonHtml(joinUrl, 'Join workspace')}</p>`,
      `<p style="margin:0;font-size:12px;color:#6b7280">If the button does not work, open this link:<br/><a href="${escapeHtml(joinUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(joinUrl)}</a></p>`,
      '</div>',
    ].join('');
    return { subject, text, html };
  }
  const simple: Record<string, RenderedEmail> = {
    verify_otp: {
      subject: 'Verify your TadScore account',
      text: `Your verification code is ${payload.code}.`,
    },
    verify_link: {
      subject: 'Verify your TadScore account',
      text: `Verify: ${app}/verify?token=${payload.token}`,
    },
    password_reset_otp: {
      subject: 'Reset your TadScore password',
      text: `Your password reset code is ${payload.code}.`,
    },
    password_reset_link: {
      subject: 'Reset your TadScore password',
      text: `Reset: ${app}/reset-password?token=${payload.token}`,
    },
    email_changed: {
      subject: 'Your TadScore email changed',
      text: 'Your account email address was changed. Contact an administrator if this was not you.',
    },
  };
  return simple[template] ?? { subject: 'TadScore notification', text: JSON.stringify(payload) };
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
        const rendered = render(item.template, item.payload);
        await transport.sendMail({
          from: config.SMTP_FROM,
          to: item.to_email,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        });
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

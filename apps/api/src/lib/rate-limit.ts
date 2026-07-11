import { pool, type DbClient } from './db.js';
import { ApiError } from './errors.js';

export async function consumeLimit(
  client: DbClient,
  scope: string,
  subject: string,
  max: number,
  windowSeconds: number,
  lockSeconds: number,
) {
  // Rate-limit state must survive a caller transaction rollback.
  const database = client === pool ? client : pool;
  const result = await database.query<{
    hit_count: number;
    window_started_at: Date;
    locked_until: Date | null;
  }>(
    `INSERT INTO auth_rate_limits(scope,subject,hit_count) VALUES($1,$2,1)
     ON CONFLICT(scope,subject) DO UPDATE SET
       hit_count=CASE WHEN auth_rate_limits.window_started_at < now()-($4*interval '1 second') THEN 1 ELSE auth_rate_limits.hit_count+1 END,
       window_started_at=CASE WHEN auth_rate_limits.window_started_at < now()-($4*interval '1 second') THEN now() ELSE auth_rate_limits.window_started_at END,
       locked_until=CASE WHEN auth_rate_limits.locked_until > now() THEN auth_rate_limits.locked_until
         WHEN auth_rate_limits.window_started_at >= now()-($4*interval '1 second') AND auth_rate_limits.hit_count+1 > $3 THEN now()+($5*interval '1 second') ELSE NULL END
     RETURNING hit_count,window_started_at,locked_until`,
    [scope, subject, max, windowSeconds, lockSeconds],
  );
  const row = result.rows[0];
  if (row?.locked_until && row.locked_until > new Date())
    throw new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.');
}

export async function clearLimit(client: DbClient, scope: string, subject: string) {
  await client.query('DELETE FROM auth_rate_limits WHERE scope=$1 AND subject=$2', [
    scope,
    subject,
  ]);
}

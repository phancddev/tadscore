import type { FastifyRequest } from 'fastify';
import { pool, type DbClient } from './db.js';

export async function audit(
  request: FastifyRequest,
  action: string,
  entityType: string,
  entityId?: string,
  data?: { workspaceId?: string; before?: object; after?: object },
  client: DbClient = pool,
) {
  await client.query(
    `INSERT INTO audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,request_id,ip_address,user_agent,before_data,after_data)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      data?.workspaceId ?? null,
      request.user?.id ?? null,
      action,
      entityType,
      entityId ?? null,
      request.id,
      request.ip,
      request.headers['user-agent'] ?? null,
      data?.before ?? null,
      data?.after ?? null,
    ],
  );
}

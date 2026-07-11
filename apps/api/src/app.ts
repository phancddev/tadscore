import { createReadStream } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './config/env.js';
import { sendError, ApiError } from './lib/errors.js';
import { pool } from './lib/db.js';
import { adminRoutes } from './modules/admin/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { avatarRoutes } from './modules/auth/avatar-routes.js';
import { workspaceRoutes } from './modules/workspaces/routes.js';
import { invitationRoutes } from './modules/workspaces/invitation-routes.js';
import { publicLinkManagementRoutes, publicRankingRoutes } from './modules/public/routes.js';
import { ruleRoutes } from './modules/rules/routes.js';
import { loadRules } from './modules/rules/registry.js';
import { scoringRoutes } from './modules/scoring/routes.js';

export async function buildApp() {
  const config = env();
  const webOrigins = config.WEB_ORIGIN.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: config.LOG_LEVEL },
    trustProxy: config.TRUST_PROXY,
    requestIdHeader: 'x-request-id',
  });
  await mkdir(config.UPLOAD_DIR, { recursive: true });
  await app.register(cookie);
  await app.register(cors, { origin: webOrigins, credentials: true });
  await app.register(multipart, { limits: { fileSize: config.MAX_AVATAR_BYTES, files: 1 } });
  await app.register(swagger, { openapi: { info: { title: 'TadScore API', version: '0.1.0' } } });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });
  await loadRules();

  app.addHook('onRequest', async (request) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      request.cookies[config.SESSION_COOKIE_NAME]
    ) {
      const origin = request.headers.origin;
      if (origin && !webOrigins.includes(origin))
        throw new ApiError(403, 'INVALID_ORIGIN', 'Request origin is not allowed');
    }
  });
  app.setErrorHandler((error, _request, reply) => sendError(error, reply));
  app.get('/health', async () => {
    await pool.query('SELECT 1');
    return { data: { status: 'ok' } };
  });
  app.get('/uploads/:filename', async (request, reply) => {
    const filename = basename((request.params as { filename: string }).filename);
    if (!/^[a-f0-9-]+-\d+\.(jpg|png|webp)$/.test(filename))
      throw new ApiError(404, 'NOT_FOUND', 'File not found');
    await access(join(config.UPLOAD_DIR, filename)).catch(() => {
      throw new ApiError(404, 'NOT_FOUND', 'File not found');
    });
    return reply
      .header('Cache-Control', 'private, max-age=3600')
      .send(createReadStream(join(config.UPLOAD_DIR, filename)));
  });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(avatarRoutes, { prefix: '/api/auth' });
  await app.register(ruleRoutes, { prefix: '/api/rules' });
  await app.register(workspaceRoutes, { prefix: '/api/workspaces' });
  await app.register(scoringRoutes, { prefix: '/api/workspaces' });
  await app.register(publicLinkManagementRoutes, { prefix: '/api/workspaces' });
  await app.register(invitationRoutes, { prefix: '/api/invitations' });
  await app.register(publicRankingRoutes, { prefix: '/api/public/rankings' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  return app;
}

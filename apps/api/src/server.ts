import { buildApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './lib/db.js';
import { processOutboxBatch } from './lib/outbox.js';

const config = env();
const app = await buildApp();
const timer = setInterval(
  () => void processOutboxBatch().catch((error) => app.log.error(error)),
  10_000,
);
await processOutboxBatch().catch((error) => app.log.warn(error));
await app.listen({ host: config.HOST, port: config.PORT });

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down');
  clearInterval(timer);
  await app.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

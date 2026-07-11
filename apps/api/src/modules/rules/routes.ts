import type { FastifyInstance } from 'fastify';
import { ruleRegistry } from './registry.js';

export async function ruleRoutes(app: FastifyInstance) {
  app.get('/', async () => ({
    data: [...ruleRegistry.rules.values()].map(({ definition, hash }) => ({ ...definition, hash })),
  }));
  app.get('/health', async () => ({ data: ruleRegistry.health }));
}

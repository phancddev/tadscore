import pg, { type PoolClient, type QueryResultRow } from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;
export const pool = new Pool({ connectionString: env().DATABASE_URL, max: 10 });
export type DbClient = Pick<PoolClient, 'query'>;

export async function rows<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
  client: DbClient = pool,
): Promise<T[]> {
  return (await client.query<T>(text, values)).rows;
}
export async function one<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
  client: DbClient = pool,
): Promise<T | undefined> {
  return (await client.query<T>(text, values)).rows[0];
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

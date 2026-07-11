import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function sendError(error: unknown, reply: FastifyReply) {
  if (error instanceof ApiError)
    return reply
      .status(error.status)
      .send({ error: { code: error.code, message: error.message, details: error.details } });
  if (error instanceof ZodError)
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.issues },
    });
  const fastifyError = error as { code?: string; statusCode?: number; message?: string };
  if (fastifyError?.code === 'FST_ERR_CTP_EMPTY_JSON_BODY')
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'JSON body cannot be empty when Content-Type is application/json',
      },
    });
  if (fastifyError?.code === 'FST_ERR_CTP_INVALID_JSON_BODY')
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' },
    });
  const pgError = error as { code?: string };
  if (pgError?.code === '23505')
    return reply
      .status(409)
      .send({ error: { code: 'CONFLICT', message: 'A record with this value already exists' } });
  if (pgError?.code === '23503')
    return reply.status(409).send({
      error: {
        code: 'REFERENCE_CONFLICT',
        message: 'A related record is missing or still in use',
      },
    });
  if (pgError?.code === '23514' || pgError?.code === '22P02')
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'The request violates a data constraint' },
    });
  reply.log.error(error);
  return reply
    .status(500)
    .send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}

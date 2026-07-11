import { createWriteStream } from 'node:fs';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import { audit } from '../../lib/audit.js';
import { one, pool } from '../../lib/db.js';
import { ApiError } from '../../lib/errors.js';
import { authenticate } from './guards.js';

export async function avatarRoutes(app: FastifyInstance) {
  app.post('/avatar', { preHandler: authenticate }, async (request, reply) => {
    const file = await request.file({ limits: { fileSize: env().MAX_AVATAR_BYTES, files: 1 } });
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      throw new ApiError(
        400,
        'INVALID_AVATAR',
        'Upload a JPEG, PNG, or WebP image within the configured size limit',
      );
    const extension = (
      { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' } as Record<string, string>
    )[file.mimetype]!;
    await mkdir(env().UPLOAD_DIR, { recursive: true });
    const filename = `${request.user!.id}-${Date.now()}${extension}`;
    const temp = join(env().UPLOAD_DIR, `${filename}.tmp`);
    try {
      await pipeline(file.file, createWriteStream(temp));
      if (file.file.truncated)
        throw new ApiError(413, 'AVATAR_TOO_LARGE', 'Avatar exceeds the configured size limit');
      await rename(temp, join(env().UPLOAD_DIR, filename));
    } catch (error) {
      await unlink(temp).catch(() => undefined);
      throw error;
    }
    const previous = await one<{ avatar_path: string | null }>(
      'SELECT avatar_path FROM users WHERE id=$1',
      [request.user!.id],
    );
    await pool.query('UPDATE users SET avatar_path=$1 WHERE id=$2', [filename, request.user!.id]);
    if (previous?.avatar_path && extname(previous.avatar_path))
      await unlink(join(env().UPLOAD_DIR, previous.avatar_path)).catch(() => undefined);
    await audit(request, 'profile.avatar.change', 'user', request.user!.id);
    return reply.send({ data: { avatarUrl: `/uploads/${filename}` } });
  });
}

import { createHash, randomBytes, randomInt } from 'node:crypto';
import argon2 from 'argon2';

export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export const randomOtp = (length: number) =>
  randomInt(0, 10 ** length)
    .toString()
    .padStart(length, '0');
export const hashPassword = (password: string) =>
  argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password);

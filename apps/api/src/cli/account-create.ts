import { stdin, stdout } from 'node:process';
import { globalRoleSchema, registerSchema } from '@tadscore/contracts';
import { pool } from '../lib/db.js';
import { hashPassword } from '../lib/security.js';

export function parseArgs(argv: string[]) {
  const values: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith('--')) continue;
    if (key === '--password-stdin') {
      values['password-stdin'] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    values[key.slice(2)] = value;
    index += 1;
  }
  return values;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const email = String(args.email ?? '');
    const username = String(args.username ?? '');
    const fullName = String(args['full-name'] ?? '');
    const role = globalRoleSchema.parse(args.role ?? 'user');
    if (!email || !username || !fullName)
      throw new Error('--email, --username, and --full-name are required');
    if (!args['password-stdin'])
      throw new Error(
        'Use --password-stdin so the password is never exposed in arguments or environment variables',
      );
    let password = '';
    for await (const chunk of stdin) password += chunk.toString();
    password = password.replace(/[\r\n]+$/, '');
    const input = registerSchema.parse({ email, username, fullName, password });
    const result = await pool.query<{ id: string }>(
      `INSERT INTO users(email,username,full_name,password_hash,global_role,status,email_verified_at) VALUES($1,$2,$3,$4,$5,'active',now()) RETURNING id`,
      [input.email, input.username, input.fullName, await hashPassword(input.password), role],
    );
    stdout.write(`Account created: ${result.rows[0]!.id} (${input.username}, ${role})\n`);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    process.stderr.write(
      `Account creation failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });

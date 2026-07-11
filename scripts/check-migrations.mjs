import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = join(process.cwd(), 'database/migrations');
const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
const failures = [];

for (const [index, name] of names.entries()) {
  const match = /^(\d{5})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/.exec(name);
  if (!match) {
    failures.push(`${name}: expected 00001_lowercase_reason.sql`);
    continue;
  }

  const expected = String(index + 1).padStart(5, '0');
  if (match[1] !== expected) failures.push(`${name}: expected sequential version ${expected}`);

  const sql = await readFile(join(directory, name), 'utf8');
  const upCount = sql.match(/^-- migrate:up$/gm)?.length ?? 0;
  const downCount = sql.match(/^-- migrate:down$/gm)?.length ?? 0;
  if (upCount !== 1 || downCount !== 1) {
    failures.push(`${name}: requires exactly one migrate:up and one migrate:down marker`);
  }
  if (sql.indexOf('-- migrate:up') > sql.indexOf('-- migrate:down')) {
    failures.push(`${name}: migrate:up must appear before migrate:down`);
  }
}

if (!names.length) failures.push('No SQL migrations found.');
for (const failure of failures) console.error(`FAIL: ${failure}`);

if (failures.length) process.exitCode = 1;
else console.log(`Migration layout passed (${names.length} migrations).`);

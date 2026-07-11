import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const warningLimit = 200;
const failureLimit = 300;
const sourceExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.jsx',
  '.mjs',
  '.scss',
  '.sql',
  '.ts',
  '.tsx',
  '.vue',
]);
const skippedDirectories = new Set([
  '.git',
  '.next',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);
const skippedFiles = new Set(['pnpm-lock.yaml']);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    const projectPath = relative(root, absolute).replaceAll('\\', '/');

    if (entry.isDirectory()) {
      if (projectPath === 'apps/web/src/components/ui') continue;
      files.push(...(await collect(absolute)));
    } else if (sourceExtensions.has(extname(entry.name)) && !skippedFiles.has(entry.name)) {
      files.push({ absolute, projectPath });
    }
  }

  return files;
}

const warnings = [];
const failures = [];

for (const file of await collect(root)) {
  const content = await readFile(file.absolute, 'utf8');
  const lines = content === '' ? 0 : content.split(/\r?\n/).length;
  if (lines > failureLimit) failures.push(`${file.projectPath}: ${lines} lines`);
  else if (lines > warningLimit) warnings.push(`${file.projectPath}: ${lines} lines`);
}

for (const warning of warnings) console.warn(`WARN >${warningLimit}: ${warning}`);
for (const failure of failures) console.error(`FAIL >${failureLimit}: ${failure}`);

if (failures.length) process.exitCode = 1;
else
  console.log(
    `Line limits passed (${warnings.length} warning${warnings.length === 1 ? '' : 's'}).`,
  );

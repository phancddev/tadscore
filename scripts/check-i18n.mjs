import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const localesRoot = join(process.cwd(), 'apps/web/src/i18n/locales');
const primary = 'en';
const secondary = 'vi';

function flattenKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      return flattenKeys(child, path);
    }
    return [path];
  });
}

async function loadNamespace(locale, fileName) {
  const raw = await readFile(join(localesRoot, locale, fileName), 'utf8');
  return JSON.parse(raw);
}

const primaryFiles = (await readdir(join(localesRoot, primary)))
  .filter((name) => name.endsWith('.json'))
  .sort();
const secondaryFiles = (await readdir(join(localesRoot, secondary)))
  .filter((name) => name.endsWith('.json'))
  .sort();

const failures = [];

for (const name of primaryFiles) {
  if (!secondaryFiles.includes(name)) failures.push(`Missing ${secondary}/${name}`);
}
for (const name of secondaryFiles) {
  if (!primaryFiles.includes(name))
    failures.push(`Extra ${secondary}/${name} (no ${primary} twin)`);
}

for (const name of primaryFiles) {
  if (!secondaryFiles.includes(name)) continue;
  let primaryJson;
  let secondaryJson;
  try {
    primaryJson = await loadNamespace(primary, name);
    secondaryJson = await loadNamespace(secondary, name);
  } catch (error) {
    failures.push(`${name}: invalid JSON (${error instanceof Error ? error.message : error})`);
    continue;
  }
  const primaryKeys = new Set(flattenKeys(primaryJson));
  const secondaryKeys = new Set(flattenKeys(secondaryJson));
  for (const key of primaryKeys) {
    if (!secondaryKeys.has(key)) failures.push(`${secondary}/${name}: missing key "${key}"`);
  }
  for (const key of secondaryKeys) {
    if (!primaryKeys.has(key)) failures.push(`${secondary}/${name}: extra key "${key}"`);
  }
}

for (const failure of failures) console.error(`FAIL: ${failure}`);

if (failures.length) process.exitCode = 1;
else {
  console.log(
    `i18n key parity passed (${primaryFiles.length} namespaces, ${primary} ↔ ${secondary}).`,
  );
}

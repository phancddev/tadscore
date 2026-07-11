import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ruleDefinitionSchema, type RuleDefinition } from './schema.js';

export interface RuleRecord {
  definition: RuleDefinition;
  hash: string;
  source: string;
}
export interface RuleHealth {
  source: string;
  ok: boolean;
  error?: string;
  id?: string;
  version?: string;
}

export class RuleRegistry {
  readonly rules = new Map<string, RuleRecord>();
  readonly health: RuleHealth[] = [];

  async load(root: string) {
    this.rules.clear();
    this.health.length = 0;
    for (const directory of await readdir(root, { withFileTypes: true })) {
      if (!directory.isDirectory()) continue;
      const source = join(root, directory.name, 'rule.json');
      try {
        const raw = await readFile(source, 'utf8');
        const definition = ruleDefinitionSchema.parse(JSON.parse(raw));
        const canonical = JSON.stringify(definition);
        const hash = createHash('sha256').update(canonical).digest('hex');
        const key = `${definition.id}@${definition.version}`;
        if (this.rules.has(key)) throw new Error(`Duplicate rule ${key}`);
        this.rules.set(key, { definition, hash, source });
        this.health.push({ source, ok: true, id: definition.id, version: definition.version });
      } catch (error) {
        this.health.push({
          source,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return this;
  }

  get(id: string, version: string) {
    return this.rules.get(`${id}@${version}`);
  }
}

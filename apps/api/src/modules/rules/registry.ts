import { RuleRegistry } from '@tadscore/rule-engine';
import { env } from '../../config/env.js';

export const ruleRegistry = new RuleRegistry();
export async function loadRules() {
  await ruleRegistry.load(env().RULE_CONFIG_PATH);
}

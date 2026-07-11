import i18n from '../../i18n';

/** Parse free-form medal adjustments such as "+5", "-2", "5", or "−3". */
export function parseMedalDelta(
  raw: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const text = raw.trim().replace(/,/g, '').replace(/−/g, '-').replace(/\s+/g, '');
  if (!text) return { ok: false, error: i18n.t('parseDelta.empty', { ns: 'scoring' }) };
  if (!/^[+-]?\d+$/.test(text))
    return { ok: false, error: i18n.t('parseDelta.invalidFormat', { ns: 'scoring' }) };
  const value = Number(text);
  if (!Number.isInteger(value) || !Number.isFinite(value))
    return { ok: false, error: i18n.t('parseDelta.invalidValue', { ns: 'scoring' }) };
  if (value === 0) return { ok: false, error: i18n.t('parseDelta.zero', { ns: 'scoring' }) };
  if (Math.abs(value) > 100_000)
    return { ok: false, error: i18n.t('parseDelta.tooLarge', { ns: 'scoring' }) };
  return { ok: true, value };
}

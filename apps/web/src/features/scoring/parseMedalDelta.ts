/** Parse free-form medal adjustments such as "+5", "-2", "5", or "−3". */
export function parseMedalDelta(
  raw: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const text = raw.trim().replace(/,/g, '').replace(/−/g, '-').replace(/\s+/g, '');
  if (!text) return { ok: false, error: 'Nhập mức thay đổi, ví dụ +5 hoặc -2' };
  if (!/^[+-]?\d+$/.test(text))
    return { ok: false, error: 'Chỉ chấp nhận số nguyên có dấu, ví dụ +5 hoặc -2' };
  const value = Number(text);
  if (!Number.isInteger(value) || !Number.isFinite(value))
    return { ok: false, error: 'Giá trị không hợp lệ' };
  if (value === 0) return { ok: false, error: 'Mức thay đổi không được bằng 0' };
  if (Math.abs(value) > 100_000) return { ok: false, error: 'Mức thay đổi tối đa là ±100000' };
  return { ok: true, value };
}

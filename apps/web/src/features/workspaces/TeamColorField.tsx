import { useTranslation } from 'react-i18next';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';

const PRESET_COLORS = [
  '#6366f1',
  '#eab308',
  '#f97316',
  '#22c55e',
  '#ef4444',
  '#06b6d4',
  '#a855f7',
  '#64748b',
  '#0f172a',
  '#ec4899',
];

/** Normalize free-form hex so `<input type="color">` can open the OS/browser picker. */
export function toColorInputValue(value: string) {
  const raw = value.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(raw);
  if (short) {
    const [r, g, b] = short[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#([0-9a-f]{6})$/i.test(raw)) return raw.toLowerCase();
  return '#64748b';
}

export function TeamColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const { t } = useTranslation('workspace');
  const selected = toColorInputValue(value);
  return (
    <Field label={t('color.label')} htmlFor="team-color" hint={t('color.hint')}>
      <div className="grid gap-3">
        <div className="flex items-center gap-3">
          <input
            id="team-color-picker"
            type="color"
            aria-label={t('color.pick')}
            value={selected}
            onChange={(event) => onChange(event.target.value)}
            className="h-11 w-14 cursor-pointer rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1"
          />
          <Input
            id="team-color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="#64748b"
            className="font-mono uppercase"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="list" aria-label={t('color.preset')}>
          {PRESET_COLORS.map((color) => {
            const active = selected === color;
            return (
              <button
                key={color}
                type="button"
                role="listitem"
                aria-label={t('color.pickNamed', { color })}
                aria-pressed={active}
                title={color}
                onClick={() => onChange(color)}
                className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-105 ${
                  active
                    ? 'border-[var(--foreground)] ring-2 ring-[var(--ring)] ring-offset-2'
                    : 'border-[var(--border)]'
                }`}
                style={{ backgroundColor: color }}
              />
            );
          })}
        </div>
      </div>
    </Field>
  );
}

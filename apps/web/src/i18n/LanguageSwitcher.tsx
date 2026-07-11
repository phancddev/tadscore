import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import type { AppLanguage } from './index';

const options: { code: AppLanguage; labelKey: 'language.vi' | 'language.en' }[] = [
  { code: 'vi', labelKey: 'language.vi' },
  { code: 'en', labelKey: 'language.en' },
];

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation('common');
  const current = (i18n.resolvedLanguage || i18n.language || 'vi').startsWith('en') ? 'en' : 'vi';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[var(--radius)] border border-[var(--border)] p-0.5',
        className,
      )}
      role="group"
      aria-label={t('language.label')}
    >
      {options.map(({ code, labelKey }) => {
        const active = current === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => void i18n.changeLanguage(code)}
            aria-pressed={active}
            aria-label={t('language.switchTo', { language: t(labelKey) })}
            className={cn(
              'min-h-9 rounded-[calc(var(--radius)-2px)] px-2.5 text-xs font-semibold uppercase tracking-wide transition-colors',
              active
                ? 'bg-[var(--muted)] text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}

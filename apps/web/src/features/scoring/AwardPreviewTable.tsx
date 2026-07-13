import { useTranslation } from 'react-i18next';
import type { AwardPreviewRow } from './awardPreview';

export function AwardPreviewTable({
  rows,
  isReplace,
  valid,
}: {
  rows: AwardPreviewRow[];
  isReplace: boolean;
  valid: boolean;
}) {
  const { t } = useTranslation('scoring');
  const { t: tc } = useTranslation('common');
  if (rows.length === 0) return null;
  return (
    <section
      aria-labelledby="rank-preview-title"
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)]/30 p-3"
    >
      <h3 id="rank-preview-title" className="m-0 text-sm font-semibold">
        {t('rank.previewTitle')}
      </h3>
      {isReplace && (
        <p className="mt-1 mb-0 text-xs text-[var(--muted-foreground)]">
          {t('rank.previewReplaceHint')}
        </p>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[16rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
              <th className="pb-2 pr-2 font-medium">{t('rank.previewTeam')}</th>
              <th className="pb-2 pr-2 font-medium">{t('rank.previewPlace')}</th>
              <th className="pb-2 pr-2 text-right font-medium tabular">
                {t('rank.previewMedals', { label: tc('metrics.medals') })}
              </th>
              <th className="pb-2 text-right font-medium tabular">
                {t('rank.previewPieces', { label: tc('metrics.pieces') })}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId} className="border-b border-[var(--border)]/60 last:border-0">
                <td className="py-2 pr-2 font-medium">{row.teamName}</td>
                <td className="py-2 pr-2 tabular text-[var(--muted-foreground)]">
                  {t('rank.place', { rank: row.rank })}
                </td>
                <td className="py-2 pr-2 text-right font-semibold tabular">{row.medals}</td>
                <td className="py-2 text-right font-semibold tabular">{row.pieces}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!valid && (
        <p className="mt-2 mb-0 text-xs text-[var(--muted-foreground)]">
          {t('rank.previewPartial')}
        </p>
      )}
    </section>
  );
}

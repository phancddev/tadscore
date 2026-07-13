import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import type { LedgerEntry } from '../../lib/types';
import { parseMedalDelta } from './parseMedalDelta';

export function LedgerEditModal({
  editing,
  deltaText,
  reason,
  saving,
  errorMessage,
  onDeltaChange,
  onReasonChange,
  onClose,
  onSave,
}: {
  editing: LedgerEntry | null;
  deltaText: string;
  reason: string;
  saving: boolean;
  errorMessage?: string;
  onDeltaChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSave: (medalDelta: number, reason: string) => void;
}) {
  const { t } = useTranslation('scoring');
  const { t: tc } = useTranslation('common');
  const parsedDelta = parseMedalDelta(deltaText);
  const reasonTrimmed = reason.trim();
  const formValid = parsedDelta.ok && reasonTrimmed.length >= 2;
  const submit = () => {
    if (!editing || !parsedDelta.ok || reasonTrimmed.length < 2) return;
    onSave(parsedDelta.value, reasonTrimmed);
  };
  return (
    <Modal
      open={!!editing}
      onClose={() => !saving && onClose()}
      title={t('ledger.editTitle')}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button loading={saving} disabled={!formValid || !editing} onClick={submit}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      {editing && (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <p className="m-0 text-sm text-[var(--muted-foreground)]">
            {t('ledger.editHint', { team: editing.teamName })}
          </p>
          <Field
            label={t('ledger.editDelta')}
            htmlFor="ledger-edit-delta"
            hint={t('ledger.editDeltaHint')}
            error={!parsedDelta.ok && deltaText ? parsedDelta.error : undefined}
          >
            <Input
              id="ledger-edit-delta"
              value={deltaText}
              onChange={(event) => onDeltaChange(event.target.value)}
              placeholder={t('quick.deltaPlaceholder')}
              autoFocus
            />
          </Field>
          <Field
            label={t('ledger.editReason')}
            htmlFor="ledger-edit-reason"
            error={
              reason.length > 0 && reasonTrimmed.length < 2 ? t('ledger.reasonTooShort') : undefined
            }
          >
            <Textarea
              id="ledger-edit-reason"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder={t('quick.reasonPlaceholder')}
              maxLength={500}
            />
          </Field>
          {errorMessage && (
            <p role="alert" className="m-0 text-sm text-[var(--destructive)]">
              {errorMessage}
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}

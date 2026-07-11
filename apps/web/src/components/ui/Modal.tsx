import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-0 text-[var(--foreground)] shadow-lg backdrop:bg-black/40"
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-5 py-4">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <Button variant="ghost" size="icon" aria-label="Đóng" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="p-5">{children}</div>
      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}

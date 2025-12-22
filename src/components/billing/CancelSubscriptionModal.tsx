import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentPeriodEnd?: string | null;
}

export default function CancelSubscriptionModal({ open, onClose, onConfirm, currentPeriodEnd }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const first = ref.current?.querySelector<HTMLElement>('button');
      first?.focus();
    }
  }, [open]);

  if (!open) return null;

  const date = currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
    >
      <div ref={ref} className="w-full max-w-sm rounded-lg bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Cancelar renovação</h2>
        <p className="mb-4 text-sm text-gray-700">
          Você continuará com acesso{date ? ` até ${date}` : ''}. Confirma cancelar a renovação?
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm"
          >
            Manter assinatura
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-red-600 px-4 py-2 text-sm text-white"
          >
            Cancelar renovação
          </button>
        </div>
      </div>
    </div>
  );
}

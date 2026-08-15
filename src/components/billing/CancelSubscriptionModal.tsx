import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { reasons: string[]; comment: string }) => void;
  currentPeriodEnd?: string | null;
}

const REASONS = [
  'Preço muito alto',
  'Não uso o suficiente',
  'Falta de funcionalidades',
  'Encontrei outra solução',
  'Dificuldade de uso',
  'Suporte insatisfatório',
  'Muitos erros / Bugs',
  'Mudança de estratégia',
  'Projeto temporário / Sazonal',
  'Outro',
];

export default function CancelSubscriptionModal({
  open,
  onClose,
  onConfirm,
  currentPeriodEnd,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedReasons([]);
      setComment('');
      const first = ref.current?.querySelector<HTMLElement>('button');
      first?.focus();
    }
  }, [open]);

  if (!open) return null;

  const date = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString()
    : null;
  const isValid = selectedReasons.length > 0 && comment.trim().length > 0;

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  };

  return (
    <div
      className="ds-scrim fixed inset-0 z-[320] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-subscription-title"
    >
      <div
        ref={ref}
        className="dashboard-scrollbar w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-[var(--ds-radius-xl)] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-5 text-[var(--ds-color-text)] shadow-[var(--ds-shadow-overlay)] sm:rounded-[var(--ds-radius-xl)] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="ds-notebook-label">Assinatura</p>
            <h2 id="cancel-subscription-title" className="mt-1 font-display text-[1.5rem] font-bold tracking-[-0.035em] text-[var(--ds-color-ink)]">
              Cancelar renovação
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="ds-icon-button ds-icon-button--ghost">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mb-6 mt-3 text-sm leading-relaxed text-[var(--ds-color-text-secondary)]">
          Você continuará com acesso{date ? ` até ${date}` : ''}. Por favor,
          conte-nos o motivo do cancelamento para nos ajudar a melhorar.
        </p>

        <div className="mb-6 space-y-3">
          <p className="text-sm font-semibold text-[var(--ds-color-ink)]">
            Selecione um ou mais motivos:
          </p>
          <div className="divide-y divide-[var(--ds-color-line)] border-y border-[var(--ds-color-line)]">
            {REASONS.map((reason) => (
              <label
                key={reason}
                className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm text-[var(--ds-color-text-secondary)]"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--ds-color-line-strong)] accent-[var(--ds-color-brand)] focus:ring-[var(--ds-color-brand)]"
                  checked={selectedReasons.includes(reason)}
                  onChange={() => toggleReason(reason)}
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-[var(--ds-color-ink)]" htmlFor="cancel-subscription-comment">
            Justificativa (obrigatório):
          </label>
          <textarea
            id="cancel-subscription-comment"
            className="ds-field h-24 resize-none text-sm"
            placeholder="Conte-nos um pouco mais sobre sua decisão..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="grid gap-2 pt-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="ds-button ds-button--secondary ds-button--block"
          >
            Manter assinatura
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ reasons: selectedReasons, comment })}
            disabled={!isValid}
            className="ds-button ds-button--danger ds-button--block"
          >
            Cancelar renovação
          </button>
        </div>
      </div>
    </div>
  );
}

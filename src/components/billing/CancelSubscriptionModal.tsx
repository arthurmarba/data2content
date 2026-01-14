import { useEffect, useRef, useState } from 'react';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={ref}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Cancelar renovação
        </h2>
        <p className="mb-6 text-sm text-gray-600">
          Você continuará com acesso{date ? ` até ${date}` : ''}. Por favor,
          conte-nos o motivo do cancelamento para nos ajudar a melhorar.
        </p>

        <div className="mb-6 space-y-3">
          <p className="text-sm font-medium text-gray-800">
            Selecione um ou mais motivos:
          </p>
          <div className="space-y-2">
            {REASONS.map((reason) => (
              <label
                key={reason}
                className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  checked={selectedReasons.includes(reason)}
                  onChange={() => toggleReason(reason)}
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-800">
            Justificativa (obrigatório):
          </label>
          <textarea
            className="w-full h-24 rounded-md border border-gray-300 p-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            placeholder="Conte-nos um pouco mais sobre sua decisão..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
          >
            Manter assinatura
          </button>
          <button
            onClick={() => onConfirm({ reasons: selectedReasons, comment })}
            disabled={!isValid}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
          >
            Cancelar renovação
          </button>
        </div>
      </div>
    </div>
  );
}

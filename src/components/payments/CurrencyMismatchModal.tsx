'use client';

import { CURRENCY_HELP } from '@/copy/stripe';
import { useEffect, useRef, useState } from 'react';
import { useEscapeToClose, useFocusTrap, useReturnFocus } from '@/lib/a11y';

interface Props {
  open: boolean;
  onClose: () => void;
  balanceCurrency: string;
  destinationCurrency: string;
  onOnboard: () => Promise<void> | void;
}

export default function CurrencyMismatchModal({
  open,
  onClose,
  balanceCurrency,
  destinationCurrency,
  onOnboard,
}: Props) {
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { remember, restore } = useReturnFocus();
  useEscapeToClose(() => open && onClose());
  useFocusTrap(ref);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      remember();
      ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else {
      restore();
    }
  }, [open, remember, restore]);

  if (!open) return null;

  const handleOnboard = async () => {
    setLoading(true);
    try {
      await onOnboard();
    } finally {
      setLoading(false);
    }
  };

  const contactSupport = () => {
    window.open('/suporte', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mismatch-title"
        className="relative w-full max-w-sm rounded-2xl bg-white p-4 shadow-lg space-y-3 focus:outline-none"
      >
        <div className="flex justify-between items-center">
          <h2 id="mismatch-title" className="font-medium text-sm" tabIndex={-1} data-autofocus>
            {`Não consigo sacar ${balanceCurrency.toUpperCase()}`}
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="inline-flex items-center justify-center h-11 min-w-[44px] px-3 text-sm">
            ×
          </button>
        </div>
        <p className="text-xs text-gray-600">
          {CURRENCY_HELP.mismatch_reason(
            balanceCurrency.toUpperCase(),
            destinationCurrency.toUpperCase()
          )}
        </p>
        <div className="space-y-2">
          <button
            onClick={handleOnboard}
            disabled={loading}
            className="w-full rounded border p-2 text-xs text-left"
          >
            Conectar outra conta que receba em {balanceCurrency.toUpperCase()}
          </button>
          <button
            onClick={handleOnboard}
            disabled={loading}
            className="w-full rounded border p-2 text-xs text-left"
          >
            Ver se minha conta aceita {balanceCurrency.toUpperCase()}
          </button>
          <button
            onClick={contactSupport}
            disabled={loading}
            className="w-full rounded border p-2 text-xs text-left"
          >
            Falar com suporte
          </button>
        </div>
      </div>
    </div>
  );
}

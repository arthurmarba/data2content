'use client';

import { useEffect, useRef } from 'react';
import { useEscapeToClose, useFocusTrap, useReturnFocus } from '@/lib/a11y';

interface Props {
  open: boolean;
  currency: string;
  amountCents: number;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  reason?: string | null;
  onOpenCurrencyHelp?: () => void;
}

function fmt(amountCents: number, cur: string) {
  const n = amountCents / 100;
  const currency = cur.toUpperCase();
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
}

export default function RedeemModal({
  open,
  currency,
  amountCents,
  onConfirm,
  onClose,
  loading,
  reason,
  onOpenCurrencyHelp,
}: Props) {
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
  const amount = fmt(amountCents, currency);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="redeem-title"
        className="relative w-full max-w-sm rounded-2xl bg-white p-4 shadow-lg focus:outline-none"
      >
        <h2 id="redeem-title" className="text-lg font-semibold" tabIndex={-1} data-autofocus>
          Resgatar {amount}
        </h2>
        {reason ? (
          <p className="mt-2 text-xs text-gray-600">
            {reason}
            {onOpenCurrencyHelp && (
              <button onClick={onOpenCurrencyHelp} className="ml-1 underline">
                Entenda como sacar {currency.toUpperCase()}
              </button>
            )}
          </p>
        ) : (
          <p className="mt-2 text-xs text-gray-600">
            Você vai transferir todo o saldo disponível em {currency.toUpperCase()} para sua conta Stripe Connect.
          </p>
        )}
        <div className="mt-4 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center h-11 min-w-[44px] px-3 text-sm"
          >
            Cancelar
          </button>
          {!reason && (
            <button
              disabled={loading}
              onClick={onConfirm}
              className="inline-flex items-center justify-center h-11 min-w-[44px] px-3 rounded bg-brand-pink text-white text-sm disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Confirmar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

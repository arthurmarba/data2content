'use client';

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
  if (!open) return null;
  const amount = fmt(amountCents, currency);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-white rounded p-4 w-80 space-y-3">
        <h4 className="font-medium text-sm">Resgatar {amount}</h4>
        {reason ? (
          <p className="text-xs text-gray-600">
            {reason}
            {onOpenCurrencyHelp && (
              <button onClick={onOpenCurrencyHelp} className="ml-1 underline">
                Entenda como sacar {currency.toUpperCase()}
              </button>
            )}
          </p>
        ) : (
          <p className="text-xs text-gray-600">
            Você vai transferir todo o saldo disponível em {currency.toUpperCase()} para sua conta Stripe Connect.
          </p>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-3 py-1 text-sm">
            Cancelar
          </button>
          {!reason && (
            <button
              disabled={loading}
              onClick={onConfirm}
              className="px-3 py-1 rounded bg-brand-pink text-white text-sm disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Confirmar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

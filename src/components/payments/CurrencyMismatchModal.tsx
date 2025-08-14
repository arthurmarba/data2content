'use client';

import { CURRENCY_HELP } from '@/copy/stripe';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  balanceCurrency: string;
  destinationCurrency: string;
}

export default function CurrencyMismatchModal({
  open,
  onClose,
  balanceCurrency,
  destinationCurrency,
}: Props) {
  const [loading, setLoading] = useState(false);
  if (!open) return null;

  const connectNew = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/affiliate/connect/link', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };

  const openPortal = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/affiliate/connect/portal');
      const data = await res.json();
      if (data.url) window.open(data.url, '_blank');
    } finally {
      setLoading(false);
    }
  };

  const contactSupport = () => {
    window.location.href = 'mailto:support@example.com';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white rounded p-4 w-80 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-medium text-sm">
            {`Não consigo sacar ${balanceCurrency.toUpperCase()}`}
          </h4>
          <button onClick={onClose} aria-label="Fechar" className="text-sm">×</button>
        </div>
        <p className="text-xs text-gray-600">
          {CURRENCY_HELP.mismatch_reason(balanceCurrency.toUpperCase(), destinationCurrency.toUpperCase())}
        </p>
        <div className="space-y-2">
          <button
            onClick={connectNew}
            disabled={loading}
            className="w-full rounded border p-2 text-xs text-left"
          >
            Conectar outra conta que receba em {balanceCurrency.toUpperCase()}
          </button>
          <button
            onClick={openPortal}
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

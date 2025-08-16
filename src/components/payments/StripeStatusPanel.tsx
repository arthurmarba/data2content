'use client';

import { useState } from 'react';
import { ConnectStatus } from '@/types/connect';
import { AffiliateSummary } from '@/types/affiliate';
import { STRIPE_DISABLED_REASON } from '@/copy/stripe';
import CurrencyMismatchModal from './CurrencyMismatchModal';

interface Props {
  status: ConnectStatus;
  summary?: AffiliateSummary;
  onRefresh?: () => void;
  onOnboard?: () => void;
}

function fmt(amountCents: number, cur: string) {
  const n = (amountCents || 0) / 100;
  const currency = (cur || 'BRL').toUpperCase();
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
}

export default function StripeStatusPanel({ status, summary, onRefresh, onOnboard }: Props) {
  const [mismatchOpen, setMismatchOpen] = useState(false);

  const dstCur = status.defaultCurrency?.toUpperCase();
  let mismatchCur: string | undefined;
  let mismatchAmount = 0;

  if (summary?.byCurrency && dstCur) {
    const by = summary.byCurrency ?? {};
    for (const cur of Object.keys(by)) {
      const info = by[cur];
      const avail = info?.availableCents ?? 0;
      if (cur.toUpperCase() !== dstCur && avail > 0) {
        mismatchCur = cur.toUpperCase();
        mismatchAmount = avail;
        break;
      }
    }
  }

  // 1. Ação mais importante: O usuário precisa configurar a conta.
  if (status.needsOnboarding) {
    return (
      <div className="rounded-xl bg-amber-50 p-4 space-y-3 text-center border border-amber-200">
        <p className="text-sm font-semibold text-amber-800">Ação necessária</p>
        <p className="text-xs text-amber-700">
          Sua conta precisa ser configurada no Stripe para que você possa receber pagamentos.
        </p>
        <button
          onClick={onOnboard}
          className="w-full rounded-md bg-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          Configurar Pagamentos via Stripe
        </button>
      </div>
    );
  }

  // 2. A conta está em análise, o usuário só pode esperar ou atualizar.
  if (status.isUnderReview) {
    return (
      <div className="rounded-xl bg-blue-50 p-4 space-y-2 text-center border border-blue-200">
        <p className="text-sm font-semibold text-blue-800">Conta em análise</p>
        <p className="text-xs text-blue-700">
          O Stripe está analisando seus dados. Isso pode levar alguns dias. Voltaremos a verificar automaticamente.
        </p>
        <button onClick={onRefresh} className="text-xs font-medium text-blue-700 underline">
          Atualizar status agora
        </button>
      </div>
    );
  }

  // 3. A conta está ativa e funcionando.
  if (status.payoutsEnabled) {
    return (
      <div className="rounded-xl bg-green-50 p-4 space-y-2 text-center border border-green-200">
        <p className="text-sm font-semibold text-green-800">Conta Ativa</p>
        <p className="text-xs text-green-700">
          Sua conta está pronta para receber pagamentos em <strong>{dstCur}</strong>.
        </p>
        {mismatchCur && dstCur && (
          <div className="bg-amber-100 text-xs p-2 rounded-md space-y-1 mt-2">
            <p className="text-amber-800">
              Você tem {fmt(mismatchAmount, mismatchCur)} em outra moeda.
              <button className="ml-1 font-semibold underline" onClick={() => setMismatchOpen(true)}>
                Saiba mais
              </button>
            </p>
          </div>
        )}
        <CurrencyMismatchModal
          open={mismatchOpen}
          onClose={() => setMismatchOpen(false)}
          balanceCurrency={mismatchCur || ''}
          destinationCurrency={dstCur || ''}
          onOnboard={onOnboard || (() => {})}
        />
      </div>
    );
  }

  // 4. Outros casos: A conta está desabilitada por um motivo específico.
  const reason = status.disabledReasonKey
    ? STRIPE_DISABLED_REASON[status.disabledReasonKey] || STRIPE_DISABLED_REASON.default
    : STRIPE_DISABLED_REASON.default;

  // Guarda para prevenir o erro de tipo 'possibly undefined'.
  if (!reason) {
    return (
       <div className="rounded-xl bg-red-50 p-4 space-y-2 text-center border border-red-200">
         <p className="text-sm font-semibold text-red-800">Ocorreu um problema</p>
         <p className="text-xs text-red-700">Não foi possível carregar o status detalhado da sua conta.</p>
       </div>
    );
  }

  return (
    <div className="rounded-xl bg-red-50 p-4 space-y-2 text-center border border-red-200">
      <p className="text-sm font-semibold text-red-800">{reason.title}</p>
      <p className="text-xs text-red-700">{reason.body}</p>
      {reason.cta === 'contact' && (
        <a href="/suporte" target="_blank" rel="noreferrer" className="text-xs font-medium text-red-700 underline">
          Falar com suporte
        </a>
      )}
    </div>
  );
}
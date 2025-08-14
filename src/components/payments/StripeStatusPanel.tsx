'use client';

import { useState } from 'react';
import { AffiliateStatus, AffiliateSummary } from '@/hooks/useAffiliateSummary';
import { STRIPE_DISABLED_REASON, STRIPE_STATUS, CURRENCY_HELP } from '@/copy/stripe';
import CurrencyMismatchModal from './CurrencyMismatchModal';

interface Props {
  status: AffiliateStatus;
  summary?: AffiliateSummary;
  onRefresh?: () => void;
  onOnboard?: () => void;
}

function fmt(amountCents: number, cur: string) {
  const n = amountCents / 100;
  const currency = cur.toUpperCase();
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
}

export default function StripeStatusPanel({ status, summary, onRefresh, onOnboard }: Props) {
  const [mismatchOpen, setMismatchOpen] = useState(false);

  const dstCur = status.defaultCurrency?.toUpperCase();
  let mismatchCur: string | undefined;
  let mismatchAmount = 0;
  if (summary && dstCur) {
    for (const cur of Object.keys(summary.byCurrency)) {
      if (cur.toUpperCase() !== dstCur && summary.byCurrency[cur].availableCents > 0) {
        mismatchCur = cur.toUpperCase();
        mismatchAmount = summary.byCurrency[cur].availableCents;
        break;
      }
    }
  }

  const reason = status.disabledReasonKey
    ? STRIPE_DISABLED_REASON[status.disabledReasonKey] || STRIPE_DISABLED_REASON.default
    : undefined;

  let badge = STRIPE_STATUS.action_needed;
  if (status.payoutsEnabled) badge = STRIPE_STATUS.verified;
  else if (status.isUnderReview) badge = STRIPE_STATUS.under_review;

  return (
    <div className="rounded-xl bg-gray-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">Status Stripe</span>
        <span className="text-xs font-semibold">{badge}</span>
      </div>
      {dstCur && (
        <div className="text-xs text-gray-600">Moeda de recebimento: {dstCur}</div>
      )}
      {mismatchCur && dstCur && (
        <div className="bg-amber-100 text-xs p-2 rounded space-y-1">
          <p>
            Você tem {fmt(mismatchAmount, mismatchCur)}. {CURRENCY_HELP.mismatch_banner(mismatchCur, dstCur)}
          </p>
          <button
            className="underline"
            onClick={() => setMismatchOpen(true)}
          >
            Entenda como sacar {mismatchCur}
          </button>
        </div>
      )}
      {!status.payoutsEnabled && reason && (
        <div className="text-xs text-gray-700 space-y-1">
          <p className="font-medium">{reason.title}</p>
          <p>{reason.body}</p>
          {reason.cta === 'onboarding' && (
            <button onClick={onOnboard} className="underline">Configurar Stripe</button>
          )}
          {reason.cta === 'contact' && (
            <button onClick={onOnboard} className="underline">Abrir conta no Stripe</button>
          )}
        </div>
      )}
      <button
        onClick={onRefresh}
        className="w-full rounded border px-3 py-1.5 text-xs font-medium"
      >
        Atualizar status
      </button>
      {mismatchCur && dstCur && (
        <CurrencyMismatchModal
          open={mismatchOpen}
          onClose={() => setMismatchOpen(false)}
          balanceCurrency={mismatchCur}
          destinationCurrency={dstCur}
        />
      )}
    </div>
  );
}

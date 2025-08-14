'use client'

import React from 'react'
import StripeStatusPanel from '@/components/payments/StripeStatusPanel'

/**
 * NOTA:
 * - Este debug injeta dados "fake" diretamente no StripeStatusPanel.
 * - O AffiliateCard normalmente busca dados via hooks. Como debug rápido,
 *   foque no StripeStatusPanel (status + moeda + banner de mismatch).
 * - Remova ou proteja esta rota antes do deploy (ex.: checar NODE_ENV).
 */

const fakeSummary = {
  byCurrency: {
    BRL: { availableCents: 123400, pendingCents: 5600, debtCents: 0, minRedeemCents: 5000, nextMatureAt: new Date(Date.now()+5*864e5).toISOString() },
    USD: { availableCents: 0, pendingCents: 2500, debtCents: 1500, minRedeemCents: 1000, nextMatureAt: new Date(Date.now()+2*864e5).toISOString() }
  }
}

const fakeStatus = {
  payoutsEnabled: false,        // force "Ação necessária"
  needsOnboarding: true,
  defaultCurrency: 'BRL',
  disabledReasonKey: 'requirements.past_due',
  isUnderReview: false,
}

export default function Page() {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Debug UI — Pagamentos & Afiliados</h1>

      {/* Painel de status + mismatch banner */}
      <StripeStatusPanel
        status={fakeStatus as any}
        summary={fakeSummary as any}
        onRefresh={() => console.log('refresh status')}
        onOnboard={() => console.log('open onboarding')}
      />

      <div className="text-sm text-gray-600">
        <p>Este mock deve exibir:</p>
        <ul className="list-disc pl-5">
          <li>Badge <strong>Ação necessária</strong> (payouts desabilitado + needsOnboarding).</li>
          <li>Linha <strong>Moeda de recebimento: BRL</strong>.</li>
          <li><strong>Banner de mismatch</strong> (saldo em USD com conta BRL) com CTA “Entenda como sacar USD”.</li>
        </ul>
      </div>
    </div>
  )
}


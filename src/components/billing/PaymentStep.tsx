// src/components/billing/PaymentStep.tsx
'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { useMemo, useState } from 'react';

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
if (!pk) console.warn('[PaymentStep] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ausente');
const stripePromise = pk ? loadStripe(pk) : Promise.resolve(null);

function InnerPayment({ clientSecret, onClose }: { clientSecret: string; onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!stripe || !elements || !isComplete) return;
    setLoading(true);
    setError(null);

    try {
      // manter a rota de sucesso usada no fluxo atual
      const returnUrl = `${window.location.origin}/billing/success`;

      const { error } = await stripe.confirmPayment({
        elements,
        // Mantemos o redirect padrão para respeitar fluxos 3DS/next_action
        confirmParams: { return_url: returnUrl },
      });

      if (error) {
        const msg =
          (error as any)?.message ||
          (error as any)?.decline_code ||
          'Não foi possível confirmar o pagamento.';
        setError(msg);
      }
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado ao confirmar pagamento.');
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || !stripe || !isComplete;

  return (
    <div className="space-y-4">
      <PaymentElement
        onChange={(ev: any) => {
          // PaymentElement emite {complete:boolean}
          if (typeof ev?.complete === 'boolean') setIsComplete(ev.complete);
        }}
        // foca automaticamente quando renderiza
        onReady={() => {
          // nada crítico aqui; apenas garante UX fluida
        }}
      />

      <div className="flex justify-end gap-2">
        <button
          className="rounded-xl border px-4 py-2 disabled:opacity-60"
          onClick={onClose}
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-60"
          onClick={handleConfirm}
          disabled={disabled}
          aria-busy={loading}
        >
          {loading ? 'Confirmando…' : 'Pagar'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-[11px] text-gray-500">
        Pagamentos processados pela Stripe. Seus dados são criptografados e não ficam na Data2Content.
      </p>
    </div>
  );
}

export default function PaymentStep({
  clientSecret,
  onClose,
}: {
  clientSecret: string;
  onClose: () => void;
}) {
  if (!clientSecret) return null;
  if (!pk) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Variável <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> não configurada.
      </div>
    );
  }

  const options: StripeElementsOptions = useMemo(
    () => ({
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: { borderRadius: '12px' },
      },
      loader: 'auto',
      locale: 'auto',
    }),
    [clientSecret]
  );

  return (
    <Elements options={options} stripe={stripePromise}>
      <InnerPayment clientSecret={clientSecret} onClose={onClose} />
    </Elements>
  );
}

'use client';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useState } from 'react';

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (!pk) console.warn('[PaymentStep] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ausente');
const stripePromise = loadStripe(pk!);

function InnerPayment({ clientSecret, onClose }: { clientSecret: string; onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  async function handleConfirm() {
    if (!stripe || !elements) return;
    setLoading(true); setError(null);
    // sempre voltar para a página com polling
    const returnUrl = `${window.location.origin}/billing/success`;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    if (error) setError(error.message || 'Não foi possível confirmar o pagamento.');
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      <div className="flex justify-end gap-2">
        <button className="rounded-xl border px-4 py-2" onClick={onClose}>Cancelar</button>
        <button className="rounded-xl bg-black px-4 py-2 text-white" onClick={handleConfirm} disabled={loading || !stripe}>
          {loading ? 'Confirmando...' : 'Pagar'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function PaymentStep({ clientSecret, onClose }: { clientSecret: string; onClose: () => void }) {
  if (!clientSecret) return null;
  return (
    <Elements options={{ clientSecret }} stripe={stripePromise}>
      <InnerPayment clientSecret={clientSecret} onClose={onClose} />
    </Elements>
  );
}

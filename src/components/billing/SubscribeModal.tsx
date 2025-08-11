'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import PaymentStep from './PaymentStep';

type Plan = 'monthly'|'annual';
type Cur = 'brl'|'usd';

interface Props {
  open: boolean;
  onClose: () => void;
  prices: { // vindo da sua API
    monthly: { brl: number; usd: number }; // valores exibidos (não IDs)
    annual: { brl: number; usd: number };
  }
}

export default function SubscribeModal({ open, onClose, prices }: Props) {
  const { data: session } = useSession();
  const [step, setStep] = useState<1|2|3>(1);
  const [plan, setPlan] = useState<Plan>('monthly');
  const [currency, setCurrency] = useState<Cur>('brl');
  const [affiliateCode, setAffiliateCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);

  if (!open) return null;

  const priceShown = plan === 'monthly' ? prices.monthly[currency] : prices.annual[currency];

  async function handleStart() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ plan, currency, affiliateCode: affiliateCode.trim() || undefined })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Falha ao iniciar assinatura');
      setClientSecret(body.clientSecret ?? null);
      setStep(3);
    } catch (e:any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Assinar plano</h2>
          <button className="text-sm text-gray-500" onClick={onClose}>Fechar</button>
        </div>

        {/* Steps header */}
        <div className="mb-6 flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-1 ${step===1?'bg-black text-white':'bg-gray-100'}`}>1. Plano & Moeda</span>
          <span>—</span>
          <span className={`rounded-full px-2 py-1 ${step===2?'bg-black text-white':'bg-gray-100'}`}>2. Cupom</span>
          <span>—</span>
          <span className={`rounded-full px-2 py-1 ${step===3?'bg-black text-white':'bg-gray-100'}`}>3. Pagamento</span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={()=>setPlan('monthly')}
                className={`rounded-xl border p-3 ${plan==='monthly'?'border-black':'border-gray-200'}`}>
                Mensal
              </button>
              <button onClick={()=>setPlan('annual')}
                className={`rounded-xl border p-3 ${plan==='annual'?'border-black':'border-gray-200'}`}>
                Anual
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={()=>setCurrency('brl')}
                className={`rounded-xl border p-3 ${currency==='brl'?'border-black':'border-gray-200'}`}>
                BRL (R$)
              </button>
              <button onClick={()=>setCurrency('usd')}
                className={`rounded-xl border p-3 ${currency==='usd'?'border-black':'border-gray-200'}`}>
                USD ($)
              </button>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Valor:</p>
              <p className="text-2xl font-semibold">
                {currency === 'brl' ? 'R$ ' : '$ '}
                {priceShown.toFixed(2)} {plan==='monthly'?'/ mês':'/ ano'}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button className="rounded-xl border px-4 py-2" onClick={onClose}>Cancelar</button>
              <button className="rounded-xl bg-black px-4 py-2 text-white" onClick={()=>setStep(2)}>
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <label className="block text-sm">Cupom / Código de Afiliado (opcional)</label>
            <input
              value={affiliateCode}
              onChange={e=>setAffiliateCode(e.target.value)}
              placeholder="Ex.: ABC123"
              className="w-full rounded-xl border px-3 py-2"
            />
            <div className="flex justify-between">
              <button className="rounded-xl border px-4 py-2" onClick={()=>setStep(1)}>Voltar</button>
              <button disabled={loading} className="rounded-xl bg-black px-4 py-2 text-white" onClick={handleStart}>
                {loading ? 'Processando...' : 'Ir para pagamento'}
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {clientSecret ? (
              <PaymentStep clientSecret={clientSecret} onClose={onClose} />
            ) : (
              <div className="rounded-xl bg-yellow-50 p-4 text-sm">
                Falta confirmar o pagamento. Recarregue e tente novamente.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


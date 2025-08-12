'use client';

import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { useMemo } from 'react';

const fetcher = (url:string) => fetch(url).then(r=>r.json());

function fmt(amountCents:number, cur:string) {
  const n = amountCents/100;
  const locale = cur === 'brl' ? 'pt-BR' : 'en-US';
  const currency = cur.toUpperCase();
  return new Intl.NumberFormat(locale, { style:'currency', currency }).format(n);
}

export default function AffiliateCard() {
  const { data: session } = useSession();

  const { data: connectStatus, mutate } = useSWR(
    '/api/affiliate/connect/status', fetcher, { revalidateOnFocus:false }
  );

  const handleOnboard = async () => {
    try {
      await fetch('/api/affiliate/connect/create', { method: 'POST' });
      const res = await fetch('/api/affiliate/connect/link', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
    }
  };

  // saldo por moeda vindos da sessão (já serializados no JWT/session callback)
  const balances: Record<string, number> = session?.user?.affiliateBalances || {};

  const entries = useMemo(
    () => Object.entries(balances).sort(([a],[b]) => a.localeCompare(b)),
    [balances]
  );

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="mb-3 text-lg font-semibold">Programa de Afiliados</h3>

      <div className="space-y-2">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-600">Cód. Afiliado</p>
          <p className="font-mono text-sm">{session?.user?.affiliateCode}</p>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-600">Link de indicação</p>
          {session?.user?.affiliateCode ? (
            <p className="break-all text-sm">
              {typeof window !== 'undefined'
                ? `${window.location.origin}/?ref=${session.user.affiliateCode}`
                : `/?ref=${session.user.affiliateCode}`}
            </p>
          ) : (
            <p className="text-sm text-gray-500">Seu código será gerado após o primeiro login.</p>
          )}
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="mb-2 text-xs text-gray-600">Saldos por moeda</p>
          {!entries.length && <p className="text-sm text-gray-500">Sem saldo ainda.</p>}
          {!!entries.length && (
            <ul className="space-y-1">
              {entries.map(([cur, cents]) => (
                <li key={cur} className="flex items-center justify-between">
                  <span className="uppercase text-xs text-gray-500">{cur}</span>
                  <span className="font-medium">{fmt(cents, cur)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!!connectStatus && (
          <div className="rounded-xl bg-gray-50 p-3 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span>Status Stripe Connect:</span>
              <span className="font-medium">
                {connectStatus.stripeAccountStatus ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Moeda destino (Connect):</span>
              <span className="uppercase">{connectStatus.destCurrency}</span>
            </div>
            {connectStatus.destCurrency &&
              Object.keys(balances).some(cur => cur !== connectStatus.destCurrency) && (
              <p className="text-xs text-amber-700">
                Observação: saldos em moeda diferente de <b>{connectStatus.destCurrency.toUpperCase()}</b>{' '}
                serão mantidos como saldo interno (fallback) até conversão/pagamento manual.
              </p>
            )}
            {connectStatus.needsOnboarding && (
              <button onClick={handleOnboard} className="mt-1 w-full rounded bg-brand-pink px-3 py-1.5 text-white text-xs font-medium hover:opacity-90">
                Configurar Stripe
              </button>
            )}
            <button onClick={() => mutate()} className="w-full rounded border px-3 py-1.5 text-xs font-medium">
              Atualizar status
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


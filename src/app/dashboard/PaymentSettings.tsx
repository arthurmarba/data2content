"use client";
import { useCallback } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());
const fmt = (cents: number, cur: string) =>
  new Intl.NumberFormat(cur === 'brl' ? 'pt-BR' : 'en-US', { style: 'currency', currency: cur.toUpperCase() }).format(cents / 100);

export default function PaymentSettings() {
  const { data: session, update: updateSession } = useSession();
  const { data: connectStatus, mutate } = useSWR('/api/affiliate/connect/status', fetcher, { revalidateOnFocus: false });

  const balances: Record<string, number> = session?.user?.affiliateBalances || {};
  const destCurrency = connectStatus?.destCurrency || null;
  const balanceCents = destCurrency ? (balances[destCurrency] ?? 0) : 0;

  const openStripe = useCallback(async () => {
    const res = await fetch('/api/affiliate/connect/create-link', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
  }, []);

  const handleRedeem = useCallback(async () => {
    const res = await fetch('/api/affiliate/redeem', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || "Erro no resgate"); return; }
    await updateSession?.();
    await mutate();
    alert("Resgate solicitado! Verifique sua conta Stripe.");
  }, [updateSession, mutate]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Stripe Connect</p>
            <p className="text-base font-semibold">
              {connectStatus?.stripeAccountStatus ?? '—'}{destCurrency ? ` · ${destCurrency.toUpperCase()}` : ''}
            </p>
          </div>
          <button onClick={openStripe} className="px-4 py-2 rounded bg-black text-white text-sm">
            {connectStatus?.needsOnboarding ? "Configurar Stripe" : "Abrir painel Stripe"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border p-4 bg-white">
        <p className="text-sm text-gray-600">Saldo disponível</p>
        <p className="text-2xl font-bold">
          {destCurrency ? fmt(balanceCents, destCurrency) : "—"}
        </p>
        <button
          disabled={!destCurrency || balanceCents <= 0 || connectStatus?.stripeAccountStatus !== 'verified'}
          onClick={handleRedeem}
          className="mt-3 px-4 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50"
        >
          Resgatar agora
        </button>
      </div>
    </div>
  );
}

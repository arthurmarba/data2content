"use client";

import { useEffect, useState } from 'react';
import SubscribeInline from '@/app/dashboard/billing/SubscribeInline';

type PricesShape = { monthly: { brl: number; usd: number }; annual: { brl: number; usd: number } };

export default function WhatsAppUpsellPage() {
  const [prices, setPrices] = useState<PricesShape | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPrices() {
      try {
        const res = await fetch('/api/billing/prices', { cache: 'no-store' });
        const data = await res.json();
        const byKey: PricesShape = { monthly: { brl: 0, usd: 0 }, annual: { brl: 0, usd: 0 } };
        const items = Array.isArray(data?.prices) ? data.prices : [];
        for (const it of items) {
          const plan = String(it.plan || '').toLowerCase();
          const currency = String(it.currency || '').toUpperCase();
          const val = typeof it.unitAmount === 'number' ? it.unitAmount / 100 : 0;
          if (plan === 'monthly' && (currency === 'BRL' || currency === 'USD')) {
            (byKey.monthly as any)[currency.toLowerCase()] = val;
          }
          if (plan === 'annual' && (currency === 'BRL' || currency === 'USD')) {
            (byKey.annual as any)[currency.toLowerCase()] = val;
          }
        }
        if (!cancelled) setPrices(byKey);
      } catch {
        if (!cancelled) setPrices({ monthly: { brl: 0, usd: 0 }, annual: { brl: 0, usd: 0 } });
      }
    }
    loadPrices();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">WhatsApp IA PRO</h1>
        <p className="text-sm text-gray-600 mt-1">Assine e ative um consultor que monitora sua performance, envia alertas e recomendações no seu WhatsApp.</p>
      </div>

      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-medium text-gray-800 mb-2">Vantagens do PRO</h2>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          <li>Alertas proativos de performance e oportunidades de conteúdo.</li>
          <li>Resumo semanal automático com destaques e prioridades.</li>
          <li>Atalhos de prompts para tirar dúvidas em tempo real.</li>
          <li>Integração direta com seu Instagram conectado.</li>
        </ul>
      </div>

      {prices ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <SubscribeInline prices={prices} />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Carregando preços…</div>
      )}
    </div>
  );
}

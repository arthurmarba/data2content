// src/app/dashboard/billing/BillingSubscribeModal.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import SubscribeModal from "@/components/billing/SubscribeModal";

interface BillingSubscribeModalProps {
  open: boolean;
  onClose: () => void;
}

type PricesShape = {
  monthly: { brl: number; usd: number };
  annual: { brl: number; usd: number };
};

type APIRawPrice = {
  plan?: string | null;
  currency?: string | null;
  unitAmount?: number | null;
};

// cache simples em escopo de módulo para reabrir o modal sem re-buscar sempre
let pricesCache: PricesShape | null = null;

export default function BillingSubscribeModal({ open, onClose }: BillingSubscribeModalProps) {
  const [prices, setPrices] = useState<PricesShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const parsePrices = (items: APIRawPrice[] | undefined | null): PricesShape => {
    const byKey: PricesShape = {
      monthly: { brl: 0, usd: 0 },
      annual: { brl: 0, usd: 0 },
    };
    const list = Array.isArray(items) ? items : [];
    for (const it of list) {
      const plan = String(it?.plan ?? "").toLowerCase();
      const currency = String(it?.currency ?? "").toUpperCase();
      const val = typeof it?.unitAmount === "number" ? it!.unitAmount / 100 : 0;
      if (plan === "monthly" && (currency === "BRL" || currency === "USD")) {
        (byKey.monthly as any)[currency.toLowerCase()] = val;
      }
      if (plan === "annual" && (currency === "BRL" || currency === "USD")) {
        (byKey.annual as any)[currency.toLowerCase()] = val;
      }
    }
    return byKey;
  };

  const loadPrices = useCallback(async () => {
    // aborta requisição anterior
    controllerRef.current?.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/prices", {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) {
        // tenta extrair mensagem de erro da API
        let message = "Falha ao carregar preços.";
        try {
          const data = await res.json();
          message = data?.error || data?.message || message;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      const data = await res.json();
      const parsed = parsePrices(data?.prices as APIRawPrice[]);
      pricesCache = parsed; // guarda no cache
      setPrices(parsed);
    } catch (e: any) {
      if (e?.name === "AbortError") return; // usuário fechou modal ou nova busca iniciou
      setError(e?.message || "Erro inesperado ao buscar preços.");
      setPrices(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // carrega quando abrir; usa cache se disponível
  useEffect(() => {
    if (!open) return;

    if (pricesCache) {
      setPrices(pricesCache);
      setError(null);
      // opcional: atualizar em background; descomente se quiser sempre “refresh”
      // loadPrices();
      return;
    }
    void loadPrices();

    return () => {
      controllerRef.current?.abort();
    };
  }, [open, loadPrices]);

  if (!open) return null;

  // Placeholder/Skeleton enquanto carrega
  if (loading && !prices && !error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label="Carregando preços">
        <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Assinar Data2Content</h2>
            <button
              className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="h-8 w-40 rounded-lg bg-gray-100 relative overflow-hidden">
              <span className="absolute inset-0 animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            </div>
            <div className="h-10 w-full rounded-xl bg-gray-100 relative overflow-hidden" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-12 rounded-xl bg-gray-100 relative overflow-hidden" />
              <div className="h-12 rounded-xl bg-gray-100 relative overflow-hidden" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Erro (com retry)
  if (error && !prices) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="billing-error-title">
        <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 id="billing-error-title" className="text-lg sm:text-xl font-semibold text-brand-dark">Assinar Data2Content</h2>
            <button
              className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={() => void loadPrices()}
                className="rounded-xl bg-gray-900 hover:bg-gray-800 px-4 py-3 text-white font-semibold"
              >
                Tentar novamente
              </button>
              <button
                onClick={onClose}
                className="rounded-xl border border-gray-300 px-4 py-3 text-gray-800 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Preços prontos
  if (prices) {
    return <SubscribeModal open={open} onClose={onClose} prices={prices} />;
  }

  // fallback defensivo (não deveria ocorrer)
  return null;
}

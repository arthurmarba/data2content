// src/app/dashboard/components/AffiliateTeaserCard.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, ArrowDownToLine, Link as LinkIcon, Copy, Share2, RefreshCw, AlertCircle } from "lucide-react";

// Tipos base
type SummaryMap = { brl?: number; usd?: number };
type AffiliateSummary = {
  available?: SummaryMap;
  pending?: SummaryMap;
  hold?: SummaryMap;
  debt?: SummaryMap;
  minPayout?: SummaryMap; // opcional
};

// Hooks (usará se existirem; senão, cai no fetch das rotas públicas)
let useAffiliateSummaryHook: any = null;
let useAffiliateCodeHook: any = null;
try {
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  useAffiliateSummaryHook = require("@/hooks/useAffiliateSummary")?.useAffiliateSummary || null;
} catch {}
try {
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  useAffiliateCodeHook = require("@/hooks/useAffiliateCode")?.useAffiliateCode || null;
} catch {}

function formatCurrency(value: number | undefined, currency: "brl" | "usd") {
  const curr = currency === "brl" ? "BRL" : "USD";
  const locale = currency === "brl" ? "pt-BR" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency: curr, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function buildShareUrl(code?: string | null) {
  if (!code) return "";
  const base = typeof window !== "undefined" ? window.location.origin : "";
  // Middleware aceita ?ref ou ?aff — vamos usar ?aff por padrão
  return `${base}/?aff=${encodeURIComponent(code)}`;
}

export default function AffiliateTeaserCard() {
  const [currency, setCurrency] = useState<"brl" | "usd">("brl");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  // Detecta locale para moeda default
  useEffect(() => {
    try {
      const lang = (typeof navigator !== "undefined" && navigator.language) || "";
      if (!/^pt(-|$)/i.test(lang)) setCurrency("usd");
    } catch {}
  }, []);

  // Usa hooks se existirem
  const hasSummaryHook = !!useAffiliateSummaryHook;
  const hasCodeHook = !!useAffiliateCodeHook;
  const codeHookData = hasCodeHook ? useAffiliateCodeHook() : null;

  const affiliateCode: string | null =
    (hasCodeHook ? (codeHookData?.code ?? null) : null);

  const shareUrl = useMemo(() => buildShareUrl(affiliateCode), [affiliateCode]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (hasSummaryHook) {
        const { summary, error } = useAffiliateSummaryHook();
        // hook pode ser assíncrono ou síncrono; tentamos duas abordagens
        if (typeof summary === "undefined") {
          // @ts-ignore
          const res = await useAffiliateSummaryHook()?.refetch?.();
          setSummary((res?.summary as AffiliateSummary) || null);
          if (res?.error) setError(String(res.error));
        } else {
          setSummary(summary as AffiliateSummary);
          if (error) setError(String(error));
        }
      } else {
        const res = await fetch("/api/affiliate/summary", { cache: "no-store" });
        if (!res.ok) {
          let message = "Falha ao carregar saldos do afiliado.";
          try {
            const data = await res.json();
            message = data?.error || data?.message || message;
          } catch {}
          throw new Error(message);
        }
        const data = await res.json();
        setSummary(data as AffiliateSummary);
      }
    } catch (e: any) {
      setError(e?.message || "Erro inesperado ao obter saldos do afiliado.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [hasSummaryHook]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const available = useMemo(() => summary?.available?.[currency] || 0, [summary, currency]);
  const minPayout = useMemo(() => summary?.minPayout?.[currency] || 0, [summary, currency]);

  const canRedeem = available > 0 && (minPayout ? available >= minPayout : true);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // opcional: toast
    } catch {}
  };

  const handleShare = async () => {
    try {
      if (navigator.share && shareUrl) {
        await navigator.share({ title: "Meu link de afiliado Data2Content", text: "Use meu link e assine a plataforma!", url: shareUrl });
      } else if (shareUrl) {
        await handleCopy(shareUrl);
      }
    } catch { /* ignore */ }
  };

  const handleRedeem = async () => {
    if (!canRedeem || redeeming) return;
    setRedeeming(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliate/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }), // API decide valor com base no available
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || body?.message || "Falha ao solicitar resgate.");
      }
      // sucesso — recarrega o summary
      await fetchSummary();
      // opcional: toast de sucesso
    } catch (e: any) {
      setError(e?.message || "Erro ao solicitar resgate.");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Head */}
      <div className="relative">
        <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-amber-400 via-pink-500 to-indigo-500" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 ring-1 ring-amber-200">
              <Wallet className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Programa de Afiliados</h3>
              <p className="text-sm text-gray-700">Indique o Data2Content e resgate suas comissões.</p>
            </div>
          </div>

          {/* Moeda */}
          <div className="inline-flex rounded-md bg-gray-100 p-1 self-start sm:self-auto">
            <button
              onClick={() => setCurrency("brl")}
              className={`px-3 py-1.5 text-sm font-medium rounded ${currency === "brl" ? "bg-white shadow text-gray-900" : "text-gray-600"}`}
              disabled={loading}
            >
              BRL
            </button>
            <button
              onClick={() => setCurrency("usd")}
              className={`px-3 py-1.5 text-sm font-medium rounded ${currency === "usd" ? "bg-white shadow text-gray-900" : "text-gray-600"}`}
              disabled={loading}
            >
              USD
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 sm:px-6 pb-5 sm:pb-6">
        {/* Saldo + Resgate */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Saldo disponível</div>
            <div className="mt-1 text-3xl font-extrabold text-gray-900">
              {loading ? "…" : formatCurrency(available, currency)}
            </div>
            {!!minPayout && (
              <div className="mt-1 text-xs text-gray-600">
                Mínimo para resgate: <span className="font-medium">{formatCurrency(minPayout, currency)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSummary()}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <button
              onClick={handleRedeem}
              disabled={!canRedeem || redeeming || loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ArrowDownToLine className="h-4 w-4" />
              {redeeming ? "Solicitando…" : "Resgatar agora"}
            </button>
          </div>
        </div>

        {/* Link de compartilhamento */}
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wide text-gray-500">Seu link de afiliado</div>

          <div className="mt-1 flex flex-col sm:flex-row gap-2">
            <div className="flex-1 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <LinkIcon className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="truncate text-sm text-gray-800" title={shareUrl || "—"}>
                {shareUrl || "—"}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => shareUrl && handleCopy(shareUrl)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={!shareUrl}
                title="Copiar link"
              >
                <Copy className="h-4 w-4" />
                Copiar
              </button>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={!shareUrl}
                title="Compartilhar"
              >
                <Share2 className="h-4 w-4" />
                Compartilhar
              </button>
            </div>
          </div>

          {/* Código em si (para quem prefere colar o código na bio/UTM) */}
          <div className="mt-2 text-xs text-gray-600">
            Código:{" "}
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-900">
              {affiliateCode || "—"}
            </span>
          </div>
        </div>

        {/* Erros */}
        {!!error && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

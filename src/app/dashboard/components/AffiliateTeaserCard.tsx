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

const useAffiliateSummary = () => {
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
      return { summary: data, error: null };
    } catch (e: any) {
      setError(e?.message || "Erro inesperado ao obter saldos do afiliado.");
      setSummary(null);
      return { summary: null, error: e?.message };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { summary, error, loading, refetch };
};

const useAffiliateCode = () => {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    // This is a placeholder. In a real app, this would fetch the user's code.
    // For now, we simulate a fetch.
    setTimeout(() => setCode("DEMO123"), 500);
  }, []);
  return { code };
};

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
  const [redeeming, setRedeeming] = useState(false);
  const { summary, error: summaryError, loading: summaryLoading, refetch: fetchSummary } = useAffiliateSummary();
  const { code: affiliateCode } = useAffiliateCode();
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // Detecta locale para moeda default
  useEffect(() => {
    try {
      const lang = (typeof navigator !== "undefined" && navigator.language) || "";
      if (!/^pt(-|$)/i.test(lang)) setCurrency("usd");
    } catch {}
  }, []);

  const shareUrl = useMemo(() => buildShareUrl(affiliateCode), [affiliateCode]);

  const available = useMemo(() => summary?.available?.[currency] || 0, [summary, currency]);
  const minPayout = useMemo(() => summary?.minPayout?.[currency] || 0, [summary, currency]);

  const canRedeem = available > 0 && (minPayout ? available >= minPayout : true);

  const handleCopy = async (text: string): Promise<"clipboard" | "execCommand" | null> => {
    // API moderna
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && typeof window !== "undefined" && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return "clipboard";
      }
    } catch {
      // segue para fallback
    }
    // Fallback compatível com Safari / contexts bloqueados
    try {
      if (typeof document === "undefined") return null;
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (success) return "execCommand";
    } catch {
      // ignore
    }
    return null;
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
    setRedeemError(null);
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
      setRedeemError(e?.message || "Erro ao solicitar resgate.");
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
              disabled={summaryLoading}
            >
              BRL
            </button>
            <button
              onClick={() => setCurrency("usd")}
              className={`px-3 py-1.5 text-sm font-medium rounded ${currency === "usd" ? "bg-white shadow text-gray-900" : "text-gray-600"}`}
              disabled={summaryLoading}
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
              {summaryLoading ? "…" : formatCurrency(available, currency)}
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
              disabled={summaryLoading}
            >
              <RefreshCw className={`h-4 w-4 ${summaryLoading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <button
              onClick={handleRedeem} 
              disabled={!canRedeem || redeeming || summaryLoading}
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
        {(!!summaryError || !!redeemError) && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {summaryError || redeemError}
          </div>
        )}
      </div>
    </div>
  );
}

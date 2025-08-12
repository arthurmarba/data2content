"use client";

import { useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";

type ConnectStatus =
  | {
      stripeAccountId: string | null;
      stripeAccountStatus: "verified" | "pending" | "disabled" | null;
      destCurrency: string | null; // em minúsculas (ex.: 'brl' | 'usd')
      needsOnboarding: boolean;
    }
  | undefined;

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error || `Erro ${r.status}`;
      throw new Error(msg);
    }
    return data;
  });

const fmt = (cents: number, cur: string) =>
  new Intl.NumberFormat(cur === "brl" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: cur.toUpperCase(),
  }).format(cents / 100);

export default function PaymentSettings() {
  const { data: session, update: updateSession } = useSession();

  const {
    data: connectStatus,
    mutate,
    isLoading: isLoadingStatus,
    error: statusError,
  } = useSWR<ConnectStatus>("/api/affiliate/connect/status", fetcher, {
    revalidateOnFocus: false,
  });

  const [isOpeningStripe, setIsOpeningStripe] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const balances: Record<string, number> =
    (session?.user as any)?.affiliateBalances || {};

  const destCurrency = connectStatus?.destCurrency || null;

  const balanceCents = useMemo(() => {
    if (!destCurrency) return 0;
    return balances[destCurrency] ?? 0;
  }, [balances, destCurrency]);

  const openStripe = useCallback(async () => {
    try {
      setIsOpeningStripe(true);

      // Cria/garante a conta
      const createRes = await fetch("/api/affiliate/connect/create", {
        method: "POST",
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        throw new Error(
          createData?.error ||
            "Falha ao criar/garantir conta Stripe. Verifique se o Stripe Connect (Express) está habilitado no seu dashboard."
        );
      }

      // Gera link (onboarding ou login)
      const linkRes = await fetch("/api/affiliate/connect/link", {
        method: "POST",
      });
      const linkData = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok || !linkData?.url) {
        throw new Error(linkData?.error || "Falha ao gerar link da Stripe.");
      }

      // Redireciona na mesma aba (mais confiável que window.open)
      window.location.href = linkData.url;
    } catch (err: any) {
      console.error("[PaymentSettings] openStripe error:", err);
      alert(err?.message || "Não foi possível abrir a Stripe agora.");
      // força revalidar status — às vezes a conta foi criada
      mutate();
    } finally {
      setIsOpeningStripe(false);
    }
  }, [mutate]);

  const handleRedeem = useCallback(async () => {
    try {
      setIsRedeeming(true);
      const res = await fetch("/api/affiliate/redeem", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Erro no resgate");
      }
      // atualiza sessão (para balances) e status (para destCurrency/verified)
      await updateSession?.();
      await mutate();
      alert("Resgate solicitado! Verifique sua conta Stripe.");
    } catch (err: any) {
      console.error("[PaymentSettings] redeem error:", err);
      alert(err?.message || "Não foi possível solicitar o resgate.");
    } finally {
      setIsRedeeming(false);
    }
  }, [updateSession, mutate]);

  const isVerified = connectStatus?.stripeAccountStatus === "verified";
  const canRedeem =
    !!destCurrency && balanceCents > 0 && isVerified && !isRedeeming;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Stripe Connect</p>
            <p className="text-base font-semibold">
              {isLoadingStatus
                ? "Carregando…"
                : connectStatus?.stripeAccountStatus ?? "—"}
              {destCurrency ? ` · ${destCurrency.toUpperCase()}` : ""}
            </p>
            {statusError && (
              <p className="text-xs text-red-600 mt-1">
                {(statusError as any)?.message || "Erro ao obter status."}
              </p>
            )}
          </div>
          <button
            onClick={openStripe}
            disabled={isOpeningStripe}
            className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-60"
          >
            {isOpeningStripe
              ? "Abrindo…"
              : connectStatus?.needsOnboarding
              ? "Configurar Stripe"
              : "Abrir painel Stripe"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border p-4 bg-white">
        <p className="text-sm text-gray-600">Saldo disponível</p>
        <p className="text-2xl font-bold">
          {destCurrency ? fmt(balanceCents, destCurrency) : "—"}
        </p>
        <button
          disabled={!canRedeem}
          onClick={handleRedeem}
          className="mt-3 px-4 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50"
        >
          {isRedeeming ? "Solicitando…" : "Resgatar agora"}
        </button>
        {!isVerified && (
          <p className="text-xs text-gray-500 mt-2">
            Conclua o onboarding da Stripe para habilitar resgates.
          </p>
        )}
      </div>
    </div>
  );
}

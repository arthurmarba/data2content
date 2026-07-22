"use client";

import { useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { track } from "@/lib/track";
import {
  canRedeem,
  getRedeemBlockReason,
  useAffiliateSummary,
  type RedeemBlockReason,
} from "@/hooks/useAffiliateSummary";
import { useConnectStatus } from "@/hooks/useConnectStatus";

export type AffiliateCopyKind = "code" | "link";

export function formatAffiliateAmount(amountCents: number, currency: string) {
  const normalizedCurrency = (currency || "BRL").toUpperCase();
  return new Intl.NumberFormat(normalizedCurrency === "BRL" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: 2,
  }).format((amountCents || 0) / 100);
}

function getReferralOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || "https://data2content.ai";
}

export function useAffiliateDashboard(options: {
  stripeReturnTo?: string;
  telemetryPrefix?: "affiliate" | "mobile_affiliate";
} = {}) {
  const { data: session } = useSession();
  const summaryQuery = useAffiliateSummary();
  const statusQuery = useConnectStatus();
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [copiedKind, setCopiedKind] = useState<AffiliateCopyKind | null>(null);
  const [a11yMessage, setA11yMessage] = useState("");
  const telemetryPrefix = options.telemetryPrefix || "affiliate";

  const affiliateCode = session?.user?.affiliateCode || null;
  const referralLink = useMemo(
    () => (affiliateCode ? `${getReferralOrigin()}/?ref=${affiliateCode}` : null),
    [affiliateCode],
  );

  const currencies = Object.keys(summaryQuery.summary?.byCurrency ?? {});
  const earningCurrency = currencies.find((currency) => {
    const entry = summaryQuery.summary?.byCurrency?.[currency];
    return (entry?.availableCents ?? 0) > 0 || (entry?.pendingCents ?? 0) > 0;
  });
  const primaryCurrency = (
    earningCurrency || statusQuery.status?.defaultCurrency || currencies[0] || "BRL"
  ).toUpperCase();
  const currencySummary = summaryQuery.summary?.byCurrency?.[primaryCurrency];
  const availableCents = currencySummary?.availableCents ?? 0;
  const pendingCents = currencySummary?.pendingCents ?? 0;
  const totalCents = availableCents + pendingCents;
  const minRedeemCents = currencySummary?.minRedeemCents ?? 0;
  const debtCents = currencySummary?.debtCents ?? 0;
  const blockReason: RedeemBlockReason | null = getRedeemBlockReason(
    statusQuery.status,
    summaryQuery.summary,
    primaryCurrency,
  );
  const redeemEnabled = canRedeem(
    statusQuery.status,
    summaryQuery.summary,
    primaryCurrency,
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([summaryQuery.refresh(), statusQuery.refresh()]);
      track(`${telemetryPrefix}_refreshed`, { currency: primaryCurrency });
    } finally {
      setRefreshing(false);
    }
  }, [primaryCurrency, statusQuery, summaryQuery, telemetryPrefix]);

  const copy = useCallback(async (value: string | null, kind: AffiliateCopyKind) => {
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKind(kind);
      setA11yMessage(kind === "link" ? "Link copiado." : "Código copiado.");
      toast.success(kind === "link" ? "Link copiado!" : "Código copiado!");
      track(`${telemetryPrefix}_${kind}_copied`);
      window.setTimeout(() => setCopiedKind((current) => (current === kind ? null : current)), 1800);
      return true;
    } catch {
      toast.error("Não foi possível copiar.");
      return false;
    }
  }, [telemetryPrefix]);

  const share = useCallback(async () => {
    if (!referralLink) return;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Meu link de afiliado", url: referralLink });
        track(`${telemetryPrefix}_link_shared`, { method: "native" });
        return;
      }
      await copy(referralLink, "link");
      track(`${telemetryPrefix}_link_shared`, { method: "clipboard" });
    } catch {
      // O cancelamento do compartilhamento nativo não é um erro de produto.
    }
  }, [copy, referralLink, telemetryPrefix]);

  const openStripe = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);
    track(`${telemetryPrefix}_stripe_started`, {
      status: statusQuery.status?.payoutsEnabled ? "active" : "onboarding",
    });
    try {
      const createResponse = await fetch("/api/affiliate/connect/create", { method: "POST" });
      const createBody = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) {
        throw new Error(createBody?.error || "Falha ao preparar sua conta Stripe.");
      }

      const linkResponse = await fetch("/api/affiliate/connect/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: options.stripeReturnTo || "/dashboard/chat" }),
      });
      const linkBody = await linkResponse.json().catch(() => ({}));
      if (!linkResponse.ok || !linkBody?.url) {
        throw new Error(linkBody?.error || "Falha ao abrir o Stripe.");
      }
      window.location.assign(linkBody.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o Stripe agora.");
      track(`${telemetryPrefix}_stripe_failed`);
      await statusQuery.refresh();
      setConnecting(false);
    }
  }, [connecting, options.stripeReturnTo, statusQuery, telemetryPrefix]);

  const redeem = useCallback(async () => {
    if (!redeemEnabled || redeeming) return false;
    setRedeeming(true);
    track(`${telemetryPrefix}_redeem_started`, {
      currency: primaryCurrency,
      amount_cents: availableCents,
    });
    try {
      const response = await fetch("/api/affiliate/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: primaryCurrency }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Não foi possível processar o recebimento.");
      toast.success(`${formatAffiliateAmount(body.amountCents, body.currency)} enviado para sua conta Stripe.`);
      track(`${telemetryPrefix}_redeem_succeeded`, {
        currency: body.currency,
        amount_cents: body.amountCents,
      });
      await Promise.all([summaryQuery.refresh(), statusQuery.refresh()]);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível processar o recebimento.");
      track(`${telemetryPrefix}_redeem_failed`, { currency: primaryCurrency });
      await Promise.all([summaryQuery.refresh(), statusQuery.refresh()]);
      return false;
    } finally {
      setRedeeming(false);
    }
  }, [availableCents, primaryCurrency, redeemEnabled, redeeming, statusQuery, summaryQuery, telemetryPrefix]);

  return {
    summary: summaryQuery.summary,
    status: statusQuery.status,
    loading: summaryQuery.loading || statusQuery.isLoading,
    error: summaryQuery.error || statusQuery.error,
    refreshing,
    connecting,
    redeeming,
    affiliateCode,
    referralLink,
    copiedKind,
    a11yMessage,
    primaryCurrency,
    currencySummary,
    availableCents,
    pendingCents,
    totalCents,
    minRedeemCents,
    debtCents,
    blockReason,
    redeemEnabled,
    refresh,
    copy,
    share,
    openStripe,
    redeem,
  };
}

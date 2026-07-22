"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  RefreshCcw,
  Share2,
  WalletCards,
  X,
} from "lucide-react";
import { track } from "@/lib/track";
import {
  formatAffiliateAmount,
  useAffiliateDashboard,
} from "@/hooks/useAffiliateDashboard";

interface Props {
  onBack: () => void;
  onClose: () => void;
}

function formatMaturity(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(date)
    .replace(" de ", " ");
}

export function DiagnosticoAffiliateView({ onBack, onClose }: Props) {
  const dashboard = useAffiliateDashboard({
    stripeReturnTo: "/dashboard/boards/mobile-strategic-profile?affiliate=1",
    telemetryPrefix: "mobile_affiliate",
  });
  const [confirmRedeem, setConfirmRedeem] = useState(false);

  useEffect(() => {
    track("mobile_affiliate_viewed");
  }, []);

  const paymentState = useMemo(() => {
    if (!dashboard.status) return null;
    if (dashboard.status.needsOnboarding) {
      return {
        tone: "warning" as const,
        title: "Conecte sua conta Stripe",
        description: "Cadastre seus dados bancários para receber suas comissões.",
        action: dashboard.connecting ? "Abrindo Stripe..." : "Conectar Stripe",
      };
    }
    if (dashboard.status.isUnderReview) {
      return {
        tone: "neutral" as const,
        title: "Cadastro em análise",
        description: "O Stripe está verificando seus dados. Você pode atualizar o status por aqui.",
        action: dashboard.refreshing ? "Atualizando..." : "Atualizar status",
      };
    }
    if (!dashboard.status.payoutsEnabled) {
      return {
        tone: "warning" as const,
        title: "Cadastro precisa de atenção",
        description: "Revise suas informações no Stripe para liberar os recebimentos.",
        action: dashboard.connecting ? "Abrindo Stripe..." : "Atualizar no Stripe",
      };
    }
    return {
      tone: "success" as const,
      title: "Stripe conectado",
      description: `Conta pronta para receber em ${dashboard.primaryCurrency}.`,
      action: "Abrir Stripe",
    };
  }, [dashboard]);

  const redeemMessage = (() => {
    const active = dashboard.currencySummary?.activeRedemption;
    if (active) return "Há um pagamento em processamento. Você pode tentar retomá-lo com segurança.";
    switch (dashboard.blockReason) {
      case "below_min": {
        const missing = Math.max(0, dashboard.minRedeemCents - dashboard.availableCents);
        return `Faltam ${formatAffiliateAmount(missing, dashboard.primaryCurrency)} para o mínimo de ${formatAffiliateAmount(dashboard.minRedeemCents, dashboard.primaryCurrency)}.`;
      }
      case "currency_mismatch":
        return `Sua conta Stripe precisa receber em ${dashboard.primaryCurrency}.`;
      case "has_debt":
        return `Existe uma pendência de ${formatAffiliateAmount(dashboard.debtCents, dashboard.primaryCurrency)} antes de um novo pagamento.`;
      case "ledger_out_of_sync":
        return "Seu saldo está em conferência. O recebimento será liberado após a conciliação.";
      case "needsOnboarding":
      case "payouts_disabled":
        return "Conecte ou atualize sua conta Stripe para receber.";
      default:
        return "Todo o saldo liberado será enviado para sua conta Stripe.";
    }
  })();

  const handlePaymentAction = () => {
    if (dashboard.status?.isUnderReview) {
      dashboard.refresh();
      return;
    }
    dashboard.openStripe();
  };

  if (dashboard.loading) {
    return (
      <div className="min-h-[34rem] px-5 pb-8">
        <AffiliateHeader onBack={onBack} onClose={onClose} />
        <div className="mt-4 animate-pulse rounded-[1.75rem] bg-zinc-950 px-5 py-8">
          <div className="h-3 w-28 rounded bg-white/20" />
          <div className="mt-4 h-10 w-44 rounded bg-white/20" />
          <div className="mt-8 h-px bg-white/10" />
          <div className="mt-5 h-8 rounded bg-white/10" />
        </div>
        <div className="mt-6 space-y-3">
          <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
        </div>
      </div>
    );
  }

  if (dashboard.error || !dashboard.summary || !dashboard.status) {
    return (
      <div className="min-h-[30rem] px-5 pb-8">
        <AffiliateHeader onBack={onBack} onClose={onClose} />
        <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-base font-bold text-zinc-950">Não foi possível carregar seu saldo</h2>
          <p className="mt-1 max-w-xs text-sm text-zinc-500">Confira sua conexão e tente novamente.</p>
          <button
            type="button"
            onClick={dashboard.refresh}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white"
          >
            <RefreshCcw className="h-4 w-4" /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const nextMaturity = formatMaturity(dashboard.currencySummary?.nextMatureAt);

  return (
    <div className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
      <span className="sr-only" aria-live="polite">{dashboard.a11yMessage}</span>
      <AffiliateHeader onBack={onBack} onClose={onClose} />

      <section className="mt-2 overflow-hidden rounded-[1.75rem] bg-zinc-950 px-5 pb-5 pt-6 text-white shadow-[0_22px_45px_rgba(9,9,11,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Saldo liberado</p>
            <p className="mt-2 font-display text-[2.25rem] font-bold tracking-[-0.05em]">
              {formatAffiliateAmount(dashboard.availableCents, dashboard.primaryCurrency)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Atualizar saldo"
            onClick={dashboard.refresh}
            disabled={dashboard.refreshing}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${dashboard.refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 border-t border-white/10 pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Aguardando</p>
            <p className="mt-1 text-[15px] font-semibold">
              {formatAffiliateAmount(dashboard.pendingCents, dashboard.primaryCurrency)}
            </p>
          </div>
          <div className="border-l border-white/10 pl-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Total</p>
            <p className="mt-1 text-[15px] font-semibold">
              {formatAffiliateAmount(dashboard.totalCents, dashboard.primaryCurrency)}
            </p>
          </div>
        </div>
        {nextMaturity ? (
          <p className="mt-4 flex items-center gap-2 text-[11px] font-medium text-white/55">
            <Clock3 className="h-3.5 w-3.5" /> Próxima liberação prevista para {nextMaturity}
          </p>
        ) : null}
      </section>

      <section className="py-6">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[var(--ds-color-brand-strong)]" />
          <h2 className="text-sm font-bold text-zinc-950">Seu link de afiliado</h2>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Você recebe 20% da primeira fatura paga por quem assina por ele.</p>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-700">
            {dashboard.referralLink || "Link indisponível"}
          </p>
          <button
            type="button"
            onClick={() => dashboard.copy(dashboard.referralLink, "link")}
            disabled={!dashboard.referralLink}
            aria-label="Copiar link de afiliado"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-zinc-800 shadow-sm disabled:opacity-40"
          >
            {dashboard.copiedKind === "link" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={dashboard.share}
            disabled={!dashboard.referralLink}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--ds-color-brand)] px-4 text-sm font-bold text-white shadow-[0_10px_24px_rgba(250,22,91,0.2)] disabled:opacity-40"
          >
            <Share2 className="h-4 w-4" /> Compartilhar
          </button>
          <button
            type="button"
            onClick={() => dashboard.copy(dashboard.affiliateCode, "code")}
            disabled={!dashboard.affiliateCode}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-4 text-xs font-bold text-zinc-700 disabled:opacity-40"
          >
            {dashboard.copiedKind === "code" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {dashboard.affiliateCode || "Código"}
          </button>
        </div>
      </section>

      <section className="border-t border-zinc-100 py-6">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
            paymentState?.tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : paymentState?.tone === "warning"
                ? "bg-amber-50 text-amber-700"
                : "bg-zinc-100 text-zinc-600"
          }`}>
            {paymentState?.tone === "success" ? <CheckCircle2 className="h-5 w-5" /> : <WalletCards className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-zinc-950">{paymentState?.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{paymentState?.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePaymentAction}
          disabled={dashboard.connecting || dashboard.refreshing}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-800 disabled:opacity-50"
        >
          {dashboard.connecting || dashboard.refreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          {paymentState?.action}
        </button>
      </section>

      <section className="border-t border-zinc-100 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-zinc-950">Receber saldo</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{redeemMessage}</p>
          </div>
          {dashboard.redeemEnabled ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-label="Recebimento disponível" /> : null}
        </div>

        {confirmRedeem ? (
          <div className="mt-4 rounded-2xl bg-zinc-100 p-4">
            <p className="text-sm font-bold text-zinc-900">
              Receber {formatAffiliateAmount(dashboard.availableCents, dashboard.primaryCurrency)}?
            </p>
            <p className="mt-1 text-xs text-zinc-500">O valor será enviado para a conta Stripe conectada.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setConfirmRedeem(false)} className="min-h-11 flex-1 rounded-xl text-sm font-semibold text-zinc-600">
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const succeeded = await dashboard.redeem();
                  if (succeeded) setConfirmRedeem(false);
                }}
                disabled={dashboard.redeeming}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-950 text-sm font-bold text-white disabled:opacity-50"
              >
                {dashboard.redeeming ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Confirmar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRedeem(true)}
            disabled={!dashboard.redeemEnabled}
            className="mt-4 min-h-12 w-full rounded-2xl bg-zinc-950 px-4 text-sm font-bold text-white transition active:scale-[0.99] disabled:bg-zinc-100 disabled:text-zinc-400"
          >
            {dashboard.currencySummary?.activeRedemption ? "Retomar recebimento" : "Receber agora"}
          </button>
        )}
      </section>
    </div>
  );
}

function AffiliateHeader({ onBack, onClose }: Props) {
  return (
    <header className="sticky top-0 z-10 -mx-1 flex items-center justify-between bg-[var(--ds-color-surface)]/95 px-1 pb-3 pt-4 backdrop-blur">
      <button
        type="button"
        onClick={onBack}
        aria-label="Voltar para configurações"
        className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-zinc-700 transition active:scale-95"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="text-center">
        <p className="font-display text-base font-bold tracking-[-0.02em] text-zinc-950">Afiliados</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Saldo e pagamentos</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar afiliados"
        className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-zinc-600 transition active:scale-95"
      >
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}

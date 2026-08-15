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
        <div className="ds-notebook-section mt-2 animate-pulse px-5 py-8">
          <div className="h-3 w-28 rounded bg-[var(--ds-color-neutral)]" />
          <div className="mt-4 h-10 w-44 rounded bg-[var(--ds-color-neutral)]" />
          <div className="mt-8 h-px bg-[var(--ds-color-line)]" />
          <div className="mt-5 h-8 rounded bg-[var(--ds-color-neutral)]" />
        </div>
        <div className="space-y-3">
          <div className="ds-notebook-section h-20 animate-pulse" />
          <div className="ds-notebook-section h-20 animate-pulse" />
        </div>
      </div>
    );
  }

  if (dashboard.error || !dashboard.summary || !dashboard.status) {
    return (
      <div className="min-h-[30rem] px-5 pb-8">
        <AffiliateHeader onBack={onBack} onClose={onClose} />
        <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-[var(--ds-color-warning-soft)] text-[var(--ds-color-warning)]">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold text-[var(--ds-color-ink)]">Não foi possível carregar seu saldo</h2>
          <p className="mt-1 max-w-xs text-sm text-[var(--ds-color-text-muted)]">Confira sua conexão e tente novamente.</p>
          <button
            type="button"
            onClick={dashboard.refresh}
            className="ds-button ds-button--secondary mt-5"
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

      <section className="ds-notebook-section mt-2 overflow-hidden px-5 pb-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="ds-notebook-label">Saldo liberado</p>
            <p className="mt-2 font-display text-[2.25rem] font-bold tracking-[-0.05em] text-[var(--ds-color-ink)]">
              {formatAffiliateAmount(dashboard.availableCents, dashboard.primaryCurrency)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Atualizar saldo"
            onClick={dashboard.refresh}
            disabled={dashboard.refreshing}
            className="ds-icon-button ds-icon-button--ghost disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${dashboard.refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 border-t border-[var(--ds-color-line)] pt-4">
          <div>
            <p className="ds-notebook-label">Aguardando</p>
            <p className="mt-1 text-[15px] font-semibold text-[var(--ds-color-ink)]">
              {formatAffiliateAmount(dashboard.pendingCents, dashboard.primaryCurrency)}
            </p>
          </div>
          <div className="border-l border-[var(--ds-color-line)] pl-4">
            <p className="ds-notebook-label">Total</p>
            <p className="mt-1 text-[15px] font-semibold text-[var(--ds-color-ink)]">
              {formatAffiliateAmount(dashboard.totalCents, dashboard.primaryCurrency)}
            </p>
          </div>
        </div>
        {nextMaturity ? (
          <p className="mt-4 flex items-center gap-2 text-[11px] font-medium text-[var(--ds-color-text-muted)]">
            <Clock3 className="h-3.5 w-3.5" /> Próxima liberação prevista para {nextMaturity}
          </p>
        ) : null}
      </section>

      <section className="ds-notebook-section py-5">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[var(--ds-color-brand-strong)]" />
          <h2 className="text-sm font-bold text-[var(--ds-color-ink)]">Seu link de afiliado</h2>
        </div>
        <p className="mt-1 text-xs text-[var(--ds-color-text-muted)]">Você recebe 20% da primeira fatura paga por quem assina por ele.</p>
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--ds-color-neutral)] px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--ds-color-text-secondary)]">
            {dashboard.referralLink || "Link indisponível"}
          </p>
          <button
            type="button"
            onClick={() => dashboard.copy(dashboard.referralLink, "link")}
            disabled={!dashboard.referralLink}
            aria-label="Copiar link de afiliado"
            className="ds-icon-button h-9 w-9 disabled:opacity-40"
          >
            {dashboard.copiedKind === "link" ? <Check className="h-4 w-4 text-[var(--ds-color-success)]" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={dashboard.share}
            disabled={!dashboard.referralLink}
            className="ds-button ds-button--primary flex-1 disabled:opacity-40"
          >
            <Share2 className="h-4 w-4" /> Compartilhar
          </button>
          <button
            type="button"
            onClick={() => dashboard.copy(dashboard.affiliateCode, "code")}
            disabled={!dashboard.affiliateCode}
            className="ds-button ds-button--quiet px-4 text-xs disabled:opacity-40"
          >
            {dashboard.copiedKind === "code" ? <Check className="h-4 w-4 text-[var(--ds-color-success)]" /> : <Copy className="h-4 w-4" />}
            {dashboard.affiliateCode || "Código"}
          </button>
        </div>
      </section>

      <section className="ds-notebook-section py-5">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
            paymentState?.tone === "success"
              ? "bg-[var(--ds-color-success-soft)] text-[var(--ds-color-success)]"
              : paymentState?.tone === "warning"
                ? "bg-[var(--ds-color-warning-soft)] text-[var(--ds-color-warning)]"
                : "bg-[var(--ds-color-neutral)] text-[var(--ds-color-text-secondary)]"
          }`}>
            {paymentState?.tone === "success" ? <CheckCircle2 className="h-5 w-5" /> : <WalletCards className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-[var(--ds-color-ink)]">{paymentState?.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ds-color-text-muted)]">{paymentState?.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePaymentAction}
          disabled={dashboard.connecting || dashboard.refreshing}
          className="ds-button ds-button--secondary ds-button--block mt-4 disabled:opacity-50"
        >
          {dashboard.connecting || dashboard.refreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          {paymentState?.action}
        </button>
      </section>

      <section className="ds-notebook-section py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--ds-color-ink)]">Receber saldo</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ds-color-text-muted)]">{redeemMessage}</p>
          </div>
          {dashboard.redeemEnabled ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--ds-color-success)]" aria-label="Recebimento disponível" /> : null}
        </div>

        {confirmRedeem ? (
          <div className="mt-4 rounded-lg bg-[var(--ds-color-neutral)] p-4">
            <p className="text-sm font-bold text-[var(--ds-color-ink)]">
              Receber {formatAffiliateAmount(dashboard.availableCents, dashboard.primaryCurrency)}?
            </p>
            <p className="mt-1 text-xs text-[var(--ds-color-text-muted)]">O valor será enviado para a conta Stripe conectada.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setConfirmRedeem(false)} className="ds-button ds-button--quiet flex-1">
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const succeeded = await dashboard.redeem();
                  if (succeeded) setConfirmRedeem(false);
                }}
                disabled={dashboard.redeeming}
                className="ds-button ds-button--secondary flex-1 disabled:opacity-50"
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
            className="ds-button ds-button--secondary ds-button--block mt-4 disabled:bg-[var(--ds-color-neutral)] disabled:text-[var(--ds-color-text-muted)]"
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
        className="ds-icon-button ds-icon-button--ghost"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="text-center">
        <p className="font-display text-base font-bold tracking-[-0.02em] text-[var(--ds-color-ink)]">Afiliados</p>
        <p className="text-[10px] font-semibold text-[var(--ds-color-text-muted)]">Saldo e pagamentos</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar afiliados"
        className="ds-icon-button ds-icon-button--ghost"
      >
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}

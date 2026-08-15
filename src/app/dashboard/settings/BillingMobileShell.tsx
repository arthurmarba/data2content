"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CreditCard,
} from "lucide-react";
import { useSubscription } from "@/hooks/billing/useSubscription";
import { buildCheckoutUrl } from "@/app/lib/checkoutRedirect";
import { openPaywallModal } from "@/utils/paywallModal";
import DeleteAccountSection from "@/app/dashboard/settings/DeleteAccountSection";
import ChangePlanCard from "@/app/dashboard/billing/ChangePlanCard";
import CancelSubscriptionModal from "@/components/billing/CancelSubscriptionModal";
import SkeletonRow from "@/components/ui/SkeletonRow";
import toast from "react-hot-toast";
import { ProfileSettingsPage } from "@/app/dashboard/boards/components/videoUpload/appPreview/ProfileSettingsPage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(value?: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const ms = value < 2_000_000_000 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) {
      const ms = value.length <= 10 ? asNum * 1000 : asNum;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(d);
  } catch {
    return d.toLocaleDateString("pt-BR");
  }
}

// ─── Bottom sheet — mudar de plano ───────────────────────────────────────────

function ChangePlanSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="ds-scrim fixed inset-0 z-[320] flex items-end justify-center px-0 pb-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <section
        className="ds-sheet max-h-[90dvh] animate-in overflow-y-auto slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Mudar de plano"
      >
        {/* drag handle */}
        <div className="mb-2 flex justify-center pt-3" aria-hidden="true">
          <div className="ds-sheet__handle !m-0" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <p className="font-display text-[1.2rem] font-bold tracking-[-0.03em] text-[var(--ds-color-ink)]">Mudar de plano</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="ds-icon-button ds-icon-button--ghost"
          >
            ✕
          </button>
        </div>
        <div className="px-5 pb-6">
          <ChangePlanCard />
        </div>
      </section>
    </div>
  );
}

// ─── Action row ───────────────────────────────────────────────────────────────

function BillingActionRow({
  label,
  icon,
  onClick,
  loading = false,
  destructive = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`ds-notebook-row disabled:opacity-60 ${destructive ? "text-[var(--ds-color-danger)]" : ""}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          destructive
            ? "bg-[var(--ds-color-danger-soft)] text-[var(--ds-color-danger)]"
            : "bg-[var(--ds-color-neutral)] text-[var(--ds-color-text-secondary)]"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 text-[14px] font-semibold">
        {loading ? "Aguarde..." : label}
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--ds-color-text-muted)]" strokeWidth={2} />
    </button>
  );
}

// ─── Swap icon (inline SVG) ───────────────────────────────────────────────────

function SwapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 5.5l5 5M10.5 5.5l-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export function BillingMobileShell() {
  const router = useRouter();
  const { subscription, error, isLoading, refresh } = useSubscription();

  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [aborting, setAborting] = useState(false);

  // ── Status flags ──────────────────────────────────────────────────────────
  const statusRaw = String(subscription?.status ?? "").toLowerCase();
  const status = statusRaw || "inactive";

  const isActive = status === "active";
  const isTrialing = status === "trialing";
  const isNonRenewing = status === "non_renewing";
  const isPending = status === "pending" || status === "incomplete";
  const isIncompleteExpired = status === "incomplete_expired";
  const isPastDue = status === "past_due";
  const isUnpaid = status === "unpaid";
  const isCanceled = status === "canceled";
  const isInactive = status === "inactive" || status === "expired";
  const billingManagedByStripe = subscription?.billingManagedByStripe !== false;

  const showReactivate = isNonRenewing && subscription?.cancelAtPeriodEnd === true;
  const canCancel = billingManagedByStripe && (isActive || isTrialing) && !subscription?.cancelAtPeriodEnd;
  const canResumeCheckout = isPending;
  const canAbortCheckout = isPending || isIncompleteExpired;
  const showSubscribeAgain = isCanceled || isInactive || isIncompleteExpired;
  const canChangePlan = billingManagedByStripe && isActive;
  const showPortal =
    billingManagedByStripe &&
    (isActive || isTrialing || isNonRenewing || isPastDue || isUnpaid) &&
    !isPending &&
    !isIncompleteExpired;
  const portalLabel = isPastDue || isUnpaid ? "Atualizar pagamento" : "Gerenciar pagamento";
  const noSubscription = !subscription;
  const isPro = isActive || isTrialing || isNonRenewing;

  // ── Formatted values ──────────────────────────────────────────────────────
  const nextInvoiceDateLabel = fmtDate(toDate(subscription?.nextInvoiceDate));
  const trialEndRaw = fmtDate(toDate(subscription?.trialEnd));
  const trialEndLabel = trialEndRaw !== "—" ? trialEndRaw : fmtDate(toDate(subscription?.currentPeriodEnd));
  const amount =
    typeof subscription?.nextInvoiceAmountCents === "number"
      ? (subscription.nextInvoiceAmountCents / 100).toLocaleString(undefined, {
          style: "currency",
          currency: (subscription.currency ?? "BRL").toUpperCase(),
        })
      : null;

  // ── Plan badge ────────────────────────────────────────────────────────────
  const planBadge = isPro
    ? { label: "Pro", className: "ds-badge--success" }
    : { label: "Free", className: "ds-badge--neutral" };

  // ── Status chip ───────────────────────────────────────────────────────────
  const statusChip = (() => {
    if (isActive && !showReactivate) return { label: "Ativo", className: "ds-badge--success" };
    if (isTrialing)                  return { label: "Plano Pro ativo", className: "ds-badge--success" };
    if (showReactivate)              return { label: "Cancelamento agendado", className: "ds-badge--danger" };
    if (isPastDue || isUnpaid)       return { label: "Pagamento pendente", className: "ds-badge--warning" };
    if (isPending)                   return { label: "Checkout pendente", className: "ds-badge--warning" };
    if (isCanceled)                  return { label: "Cancelado", className: "ds-badge--neutral" };
    return                                  { label: "Sem plano", className: "ds-badge--neutral" };
  })();

  // ── Calm status subtitle (1 fact per state) ───────────────────────────────
  const statusSubtitle = (() => {
    if (isPro && !billingManagedByStripe) {
      return "Seu acesso Pro está ativo. Não há cobrança recorrente vinculada a esta conta.";
    }
    if (isTrialing && amount && trialEndLabel !== "—") {
      return `Próxima cobrança de ${amount} em ${nextInvoiceDateLabel !== "—" ? nextInvoiceDateLabel : trialEndLabel}.`;
    }
    if (isActive && !showReactivate && amount && nextInvoiceDateLabel !== "—") {
      return `Renova em ${nextInvoiceDateLabel}.`;
    }
    if (showReactivate) return "Plano ativo até o fim do ciclo. Reative para continuar.";
    if (isPastDue || isUnpaid) return "Atualize o método de pagamento para manter o acesso.";
    if (isPending) return "Conclua o checkout para ativar o plano.";
    if (noSubscription || isCanceled || isInactive) {
      return "Seu mapa já está sendo construído. Com o Pro, cada leitura fica mais profunda — e suas pautas aparecem.";
    }
    return null;
  })();

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function openPortal() {
    try {
      setOpeningPortal(true);
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast.error(data?.message ?? "Não foi possível abrir o portal de cobrança."); return; }
      window.location.href = data.url;
    } catch { toast.error("Não foi possível abrir o portal de cobrança."); }
    finally { setOpeningPortal(false); }
  }

  async function reactivate() {
    try {
      setReactivating(true);
      const res = await fetch("/api/billing/reactivate", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.code === "NOT_REACTIVATABLE_USE_SUBSCRIBE") {
          await refresh();
          openPaywallModal({ context: "narrative_map", source: "billing_reactivate_fallback" });
          return;
        }
        toast.error(data?.message ?? "Não foi possível reativar no momento.");
        return;
      }
      toast.success("Assinatura reativada.");
      await refresh();
      window.dispatchEvent(new Event("billing-status-refresh"));
    } catch { toast.error("Não foi possível concluir no momento."); }
    finally { setReactivating(false); }
  }

  async function resumeCheckout() {
    try {
      setResuming(true);
      const res = await fetch("/api/billing/resume", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.code === "SUBSCRIPTION_ACTIVE") { toast.success("Assinatura já está ativa."); await refresh(); return; }
        toast.error(data?.message ?? "Falha ao retomar o checkout.");
        return;
      }
      if (!data?.clientSecret) { toast.error("Não foi possível retomar o pagamento."); return; }
      router.push(buildCheckoutUrl(data.clientSecret, data.subscriptionId));
    } catch { toast.error("Falha ao retomar o checkout."); }
    finally { setResuming(false); window.dispatchEvent(new Event("billing-status-refresh")); }
  }

  async function abortPending() {
    if (!confirm("Abortar tentativa pendente? Isso libera um novo checkout.")) return;
    try {
      setAborting(true);
      const res = await fetch("/api/billing/abort", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast.error(data?.message ?? "Falha ao abortar tentativa."); return; }
      toast.success("Tentativa cancelada. Você pode assinar novamente.");
      await refresh();
      window.dispatchEvent(new Event("billing-status-refresh"));
    } catch { toast.error("Falha ao abortar tentativa."); }
    finally { setAborting(false); }
  }

  async function cancel({ reasons, comment }: { reasons: string[]; comment: string }) {
    try {
      setCanceling(true);
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasons, comment }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { toast.error(data?.message ?? "Não foi possível cancelar a renovação."); return; }
      toast.success("Renovação cancelada.");
      await refresh();
      window.dispatchEvent(new Event("billing-status-refresh"));
    } catch { toast.error("Não foi possível concluir no momento."); }
    finally { setCanceling(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ProfileSettingsPage
      title="Seu plano"
      onBack={() => router.back()}
      backLabel="Voltar ao Perfil"
      contentClassName="max-w-2xl"
      action={
        !isLoading ? (
          <span className={`ds-badge ${planBadge.className}`}>{planBadge.label}</span>
        ) : null
      }
    >
      <div className="space-y-3">

        <section className="ds-notebook-section ds-notebook-section--first">
          {isLoading ? (
            <SkeletonRow />
          ) : error ? (
            <div className="ds-status-panel ds-status-panel--danger" role="status">
              <p className="text-[13px] font-medium">Erro ao carregar assinatura.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="ds-section-label">Assinatura</p>
                  <h2 className="mt-2 font-display text-[1.35rem] font-bold tracking-[-0.035em] text-[var(--ds-color-ink)]">
                    {subscription?.planName ? `Plano ${subscription.planName}` : "Plano"}
                  </h2>
                  {statusSubtitle && (
                    <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-[var(--ds-color-text-secondary)]">
                      {statusSubtitle}
                    </p>
                  )}
                </div>
                <span className={`ds-badge shrink-0 ${statusChip.className}`}>
                  {statusChip.label}
                </span>
              </div>

              {subscription?.paymentMethodLast4 && (
                <div className="mt-4 flex items-center gap-2 border-t border-[var(--ds-color-line)] pt-4 text-[12px] text-[var(--ds-color-text-muted)]">
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  <span>Cartão final {subscription.paymentMethodLast4}</span>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Actions (1 primary per state) ── */}
        {!isLoading && !error && (
          <>
            {/* Sem assinatura / inativo / cancelado */}
            {(noSubscription || showSubscribeAgain) && (
              <>
                <button
                  type="button"
                  onClick={() => openPaywallModal({ context: "narrative_map", source: "billing_settings_cta" })}
                  className="ds-button ds-button--primary w-full"
                >
                  {isCanceled ? "Ativar Pro novamente →" : "Ativar plano Pro →"}
                </button>
              </>
            )}

            {/* Cancelamento agendado — reativar */}
            {showReactivate && (
              <button
                  type="button"
                  onClick={reactivate}
                  disabled={reactivating}
                  className="ds-button ds-button--primary w-full disabled:opacity-60"
                >
                {reactivating ? "Reativando..." : "Reativar assinatura"}
              </button>
            )}

            {/* Checkout pendente — concluir */}
            {canResumeCheckout && (
              <button
                  type="button"
                  onClick={resumeCheckout}
                  disabled={resuming}
                  className="ds-button ds-button--primary w-full disabled:opacity-60"
                >
                {resuming ? "Continuando..." : "Concluir checkout →"}
              </button>
            )}

            {/* Ações secundárias — portal, mudar plano, cancelar */}
            {(showPortal || canChangePlan || canAbortCheckout || canCancel) && (
              <section className="ds-notebook-section !py-2">
                <p className="ds-section-label px-1 pb-2 pt-2">Gerenciar plano</p>
                {showPortal && (
                  <BillingActionRow
                    label={portalLabel}
                    icon={<CreditCard className="h-4 w-4" strokeWidth={1.9} />}
                    onClick={openPortal}
                    loading={openingPortal}
                  />
                )}
                {canChangePlan && (
                  <BillingActionRow
                    label="Mudar de plano"
                    icon={<SwapIcon />}
                    onClick={() => setShowChangePlan(true)}
                  />
                )}
                {canAbortCheckout && (
                  <BillingActionRow
                    label="Abortar tentativa pendente"
                    icon={<XCircleIcon />}
                    onClick={abortPending}
                    loading={aborting}
                    destructive
                  />
                )}
                {canCancel && (
                  <BillingActionRow
                    label="Cancelar renovação"
                    icon={<XCircleIcon />}
                    onClick={() => setShowCancelModal(true)}
                    loading={canceling}
                    destructive
                  />
                )}
              </section>
            )}
          </>
        )}

        {/* ── Encerrar conta (colapsável) ── */}
        <section className="ds-notebook-section overflow-hidden !p-0">
          <button
            type="button"
            onClick={() => setShowAccount((v) => !v)}
            className="flex min-h-14 w-full items-center justify-between px-5 py-4 text-left"
            aria-expanded={showAccount}
          >
            <span className="text-[14px] font-semibold text-[var(--ds-color-text-secondary)]">Encerrar conta</span>
            {showAccount ? (
              <ChevronUp className="h-4 w-4 text-[var(--ds-color-text-muted)]" strokeWidth={2} />
            ) : (
              <ChevronDown className="h-4 w-4 text-[var(--ds-color-text-muted)]" strokeWidth={2} />
            )}
          </button>
          {showAccount && (
            <div className="border-t border-[var(--ds-color-line)] px-5 pb-5 pt-4">
              <DeleteAccountSection
                hideHeading
                onManageSubscription={() => setShowChangePlan(true)}
              />
            </div>
          )}
        </section>
      </div>

      {/* ── Bottom sheet — mudar de plano ── */}
      {showChangePlan && <ChangePlanSheet onClose={() => setShowChangePlan(false)} />}

      {/* ── Cancel modal ── */}
      <CancelSubscriptionModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={(data) => {
          cancel(data);
          setShowCancelModal(false);
        }}
        currentPeriodEnd={subscription?.currentPeriodEnd}
      />
    </ProfileSettingsPage>
  );
}

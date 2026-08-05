"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
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
      className="fixed inset-0 z-50 flex items-end bg-zinc-950/35 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
      onClick={onClose}
    >
      <section
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-[1.5rem] border border-zinc-200 bg-white shadow-[0_28px_80px_rgba(24,24,27,0.18)] animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Mudar de plano"
      >
        {/* drag handle */}
        <div className="mb-2 flex justify-center pt-3" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <p className="text-[16px] font-bold tracking-tight text-zinc-900">Mudar de plano</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200"
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
      className={`flex w-full items-center gap-3 rounded-[20px] bg-white px-5 py-4 text-left
        shadow-[0_1px_4px_rgba(28,28,30,0.08)] transition active:scale-[0.98]
        disabled:opacity-60 ${destructive ? "text-rose-600" : "text-zinc-800"}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
          ${destructive ? "bg-rose-50" : "bg-zinc-100"}`}
      >
        {icon}
      </span>
      <span className="flex-1 text-[14px] font-semibold">
        {loading ? "Aguarde..." : label}
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" strokeWidth={2} />
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

  const showReactivate = isNonRenewing && subscription?.cancelAtPeriodEnd === true;
  const canCancel = (isActive || isTrialing) && !subscription?.cancelAtPeriodEnd;
  const canResumeCheckout = isPending;
  const canAbortCheckout = isPending || isIncompleteExpired;
  const showSubscribeAgain = isCanceled || isInactive || isIncompleteExpired;
  const canChangePlan = isActive;
  const showPortal =
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
    ? { label: "Pro", bg: "bg-emerald-50", text: "text-emerald-800" }
    : { label: "Free", bg: "bg-amber-50", text: "text-amber-800" };

  // ── Status chip ───────────────────────────────────────────────────────────
  const statusChip = (() => {
    if (isActive && !showReactivate) return { label: "Ativo", bg: "bg-emerald-50", text: "text-emerald-700" };
    if (isTrialing)                  return { label: "Plano Pro ativo", bg: "bg-blue-50", text: "text-blue-700" };
    if (showReactivate)              return { label: "Cancelamento agendado", bg: "bg-rose-50", text: "text-rose-700" };
    if (isPastDue || isUnpaid)       return { label: "Pagamento pendente", bg: "bg-red-50", text: "text-red-700" };
    if (isPending)                   return { label: "Checkout pendente", bg: "bg-red-50", text: "text-red-700" };
    if (isCanceled)                  return { label: "Cancelado", bg: "bg-zinc-100", text: "text-zinc-500" };
    return                                  { label: "Sem plano", bg: "bg-zinc-100", text: "text-zinc-500" };
  })();

  // ── Calm status subtitle (1 fact per state) ───────────────────────────────
  const statusSubtitle = (() => {
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

  async function cancel({ reasonCodes, comment }: { reasonCodes: string[]; comment: string }) {
    try {
      setCanceling(true);
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasonCodes, comment }),
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
    <div
      className="min-h-screen bg-[#F4F4F8]"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-[#F4F4F8]/95 px-4 pb-3 pt-3 backdrop-blur-sm">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => router.back()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm transition active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <h1 className="flex-1 text-[17px] font-bold tracking-tight text-zinc-900">
          Seu plano
        </h1>
        {!isLoading && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${planBadge.bg} ${planBadge.text}`}
          >
            {planBadge.label}
          </span>
        )}
      </header>

      {/* ── Content ── */}
      <div className="space-y-3 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] pt-2">

        {/* Status card */}
        <div className="rounded-[20px] bg-white p-5 shadow-[0_1px_4px_rgba(28,28,30,0.08)]">
          {isLoading ? (
            <SkeletonRow />
          ) : error ? (
            <p className="text-[13px] text-zinc-400">Erro ao carregar assinatura.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-zinc-900">
                    {subscription?.planName ? `Plano ${subscription.planName}` : "Plano"}
                  </p>
                  {statusSubtitle && (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
                      {statusSubtitle}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusChip.bg} ${statusChip.text}`}
                >
                  {statusChip.label}
                </span>
              </div>

              {subscription?.paymentMethodLast4 && (
                <p className="mt-3 text-[12px] text-zinc-400">
                  Cartão **** {subscription.paymentMethodLast4}
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Actions (1 primary per state) ── */}
        {!isLoading && !error && (
          <>
            {/* Sem assinatura / inativo / cancelado */}
            {(noSubscription || showSubscribeAgain) && (
              <>
                <button
                  type="button"
                  onClick={() => openPaywallModal({ context: "narrative_map", source: "billing_settings_cta" })}
                  className="flex min-h-[52px] w-full items-center justify-center rounded-[20px] bg-gradient-to-r from-[#D62E5E] to-[#9326A6] px-4 py-3 text-[15px] font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98]"
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
                className="flex min-h-[52px] w-full items-center justify-center rounded-[20px] bg-gradient-to-r from-[#D62E5E] to-[#9326A6] px-4 py-3 text-[15px] font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
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
                className="flex min-h-[52px] w-full items-center justify-center rounded-[20px] bg-gradient-to-r from-[#D62E5E] to-[#9326A6] px-4 py-3 text-[15px] font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
              >
                {resuming ? "Continuando..." : "Concluir checkout →"}
              </button>
            )}

            {/* Ações secundárias — portal, mudar plano, cancelar */}
            {(showPortal || canChangePlan || canAbortCheckout || canCancel) && (
              <div className="space-y-2">
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
              </div>
            )}
          </>
        )}

        {/* ── Encerrar conta (colapsável) ── */}
        <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_1px_4px_rgba(28,28,30,0.08)]">
          <button
            type="button"
            onClick={() => setShowAccount((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            aria-expanded={showAccount}
          >
            <span className="text-[14px] font-semibold text-zinc-500">Encerrar conta</span>
            {showAccount ? (
              <ChevronUp className="h-4 w-4 text-zinc-300" strokeWidth={2} />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-300" strokeWidth={2} />
            )}
          </button>
          {showAccount && (
            <div className="border-t border-zinc-100 px-5 pb-5 pt-4">
              <DeleteAccountSection
                hideHeading
                onManageSubscription={() => setShowChangePlan(true)}
              />
            </div>
          )}
        </div>
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
    </div>
  );
}

// src/app/dashboard/settings/DeleteAccountSection.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";

type SessionUser = {
  planStatus?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  planExpiresAt?: string | Date | null;
  affiliateBalances?: Record<string, number> | Map<string, number>;
};

type PlanStatus =
  | "active"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "canceled"
  | "inactive"
  | "non_renewing";

type Interval = "month" | "year" | null;

type BillingStatus = {
  ok: boolean;
  planStatus: PlanStatus;
  planInterval: Interval;
  planExpiresAt: string | null;
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
  hasActiveAccess: boolean;
  canDeleteAccount: boolean;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  lastPaymentError: any | null;
} | null;

type DeleteAccountSectionProps = {
  onManageSubscription?: () => void;
  /** Oculta o heading interno "Excluir conta" quando já existe um título externo. */
  hideHeading?: boolean;
};

export default function DeleteAccountSection({ onManageSubscription, hideHeading = false }: DeleteAccountSectionProps = {}) {
  const { data: session } = useSession();
  const user = (session?.user as SessionUser) || {};

  // ---------- Novo: carregar status normalizado do backend ----------
  const [billing, setBilling] = useState<BillingStatus>(null);
  const [billingLoaded, setBillingLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/billing/status", {
          cache: "no-store",
          credentials: "include",
        });
        const data = (await res.json()) as BillingStatus;
        if (alive && data && (data as any)?.ok) {
          setBilling(data);
        }
      } catch {
        // silencioso: mantemos fallback na sessão
      } finally {
        if (alive) setBillingLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---------- Derivações a partir do status preferindo o backend ----------
  const planStatus: string =
    (billing?.planStatus as string) ?? (user.planStatus || "");

  const isScheduledForCancellation: boolean =
    billing?.cancelAtPeriodEnd ?? (user.cancelAtPeriodEnd === true);

  const ACTIVE_LIKE = new Set(["active", "past_due", "unpaid"]);
  const isPlanActiveLike = ACTIVE_LIKE.has(planStatus as any);

  // Bloqueia exclusão quando está ativa (ou com cobrança pendente) e NÃO há cancelamento agendado
  const isDeletionBlocked = isPlanActiveLike && !isScheduledForCancellation;

  // Fonte única pra “até quando”: preferimos cancelAt do backend; fallback p/ planExpiresAt
  const effectiveCancelAt: Date | null = useMemo(() => {
    const iso =
      billing?.cancelAt ??
      (isScheduledForCancellation
        ? (typeof user.planExpiresAt === "string" || user.planExpiresAt instanceof Date
            ? user.planExpiresAt
            : null)
        : null);
    if (!iso) return null;
    try {
      return iso instanceof Date ? iso : new Date(iso);
    } catch {
      return null;
    }
  }, [billing?.cancelAt, isScheduledForCancellation, user.planExpiresAt]);

  const expiresAtLabel = useMemo(() => {
    if (!effectiveCancelAt) return null;
    try {
      return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
        effectiveCancelAt
      );
    } catch {
      return effectiveCancelAt.toLocaleDateString?.() ?? String(effectiveCancelAt);
    }
  }, [effectiveCancelAt]);

  // ---------- Afiliados ----------
  const affiliateBalancesRaw = user.affiliateBalances || {};
  const affiliateBalances =
    affiliateBalancesRaw instanceof Map
      ? Object.fromEntries(affiliateBalancesRaw as Map<string, number>)
      : (affiliateBalancesRaw as Record<string, number>);

  const hasAffiliateBalance = Object.values(affiliateBalances || {}).some(
    (v) => Number(v) > 0
  );

  // ---------- UI modais ----------
  const [showBlocked, setShowBlocked] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClick = () => {
    if (isDeletionBlocked) setShowBlocked(true);
    else setShowConfirm(true);
  };

  const scrollToManage = () => {
    setShowBlocked(false);
    if (onManageSubscription) {
      onManageSubscription();
      return;
    }
    const el = document.getElementById("subscription-management-title");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.location.href = "/dashboard/settings#subscription-management-title";
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (res.ok) {
        toast.success("Conta excluída com sucesso.");
        await signOut({ callbackUrl: "/" });
        return;
      }

      const data = await res.json().catch(() => null as any);

      // erros conhecidos do backend
      if (res.status === 409 && data?.error === "ERR_ACTIVE_SUBSCRIPTION") {
        toast.error("Cancele sua assinatura antes de excluir a conta.");
        setShowConfirm(false);
        setShowBlocked(true);
        return;
      }

      if (res.status === 409 && data?.error === "ERR_AFFILIATE_BALANCE") {
        toast.error(
          data?.message ||
            "Você possui comissões pendentes. Solicite o saque antes de excluir a conta."
        );
        return;
      }

      if (res.status === 429) {
        toast.error("Muitas tentativas. Tente novamente em instantes.");
        return;
      }

      if (res.status === 401) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        return;
      }

      toast.error(data?.message || "Não foi possível excluir sua conta agora.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section id="delete-account" className="space-y-4">
      {!hideHeading && (
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--ds-color-danger)]">
          <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Excluir conta
        </h3>
      )}

      {/* Informação quando a renovação já está agendada */}
      {isScheduledForCancellation && (
        <p className="ds-status-panel ds-status-panel--success text-[13px] leading-relaxed">
          Sua assinatura está com <b>cancelamento agendado</b>
          {expiresAtLabel ? (
            <>
              {" "}
              e permanecerá ativa até <b>{expiresAtLabel}</b>. Você já pode excluir sua conta
              permanentemente, se desejar.
            </>
          ) : (
            <> e não será renovada. Você já pode excluir sua conta permanentemente, se desejar.</>
          )}
        </p>
      )}

      {/* Bloqueio quando ainda está ativa e não agendada para encerrar */}
      {isDeletionBlocked && (
        <p className="ds-status-panel ds-status-panel--warning text-[13px] leading-relaxed">
          Você possui uma assinatura ativa. Para excluir sua conta, primeiro cancele a renovação
          automática na seção de gerenciamento de planos.
        </p>
      )}

      <button
        type="button"
        className="ds-button ds-button--danger ds-button--block"
        onClick={handleClick}
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        Excluir minha conta
      </button>

      {/* Modal bloqueado */}
      <AnimatePresence>
        {showBlocked && (
          <motion.div
            className="ds-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowBlocked(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-[var(--ds-radius-lg)] bg-[var(--ds-color-surface)] p-6 shadow-[var(--ds-shadow-overlay)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-blocked-title"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="delete-account-blocked-title" className="mb-2 text-[16px] font-semibold text-[var(--ds-color-ink)]">Ação necessária</h3>
              <p className="mb-4 text-[14px] leading-relaxed text-[var(--ds-color-text-secondary)]">
                Para excluir sua conta, primeiro cancele sua assinatura na seção de gerenciamento de
                planos.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="ds-button ds-button--ghost ds-button--small"
                  onClick={() => setShowBlocked(false)}
                >
                  Entendi
                </button>
                <button
                  type="button"
                  className="ds-button ds-button--primary ds-button--small"
                  onClick={scrollToManage}
                >
                  Gerenciar assinatura
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmação */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            className="ds-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
            role="presentation"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-[var(--ds-radius-lg)] bg-[var(--ds-color-surface)] p-6 shadow-[var(--ds-shadow-overlay)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-confirm-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="delete-account-confirm-title" className="mb-2 text-[16px] font-semibold text-[var(--ds-color-ink)]">Tem certeza?</h3>
              <p className="mb-4 text-[14px] leading-relaxed text-[var(--ds-color-text-secondary)]">
                Esta ação é permanente e não pode ser desfeita. Para confirmar, digite{" "}
                <strong>EXCLUIR</strong> no campo abaixo.
              </p>

              {Object.keys(affiliateBalances).length > 0 && (
                <div className="ds-status-panel ds-status-panel--warning mb-4 text-[13px] leading-relaxed">
                  {Object.entries(affiliateBalances).map(([cur, val]) => (
                    <div key={cur}>
                      Aviso: Você tem um saldo de afiliado de {val} em {cur}. Considere resgatá-lo
                      antes de excluir a conta.
                    </div>
                  ))}
                </div>
              )}

              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder='Digite "EXCLUIR"'
                className="ds-field mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="ds-button ds-button--ghost ds-button--small"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="ds-button ds-button--danger ds-button--small"
                  disabled={confirmText !== "EXCLUIR" || isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? "Excluindo..." : "Excluir permanentemente"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

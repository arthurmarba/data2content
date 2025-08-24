// src/app/dashboard/settings/DeleteAccountSection.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

type SessionUser = {
  planStatus?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  planExpiresAt?: string | Date | null;
  affiliateBalances?: Record<string, number> | Map<string, number>;
};

type PlanStatus =
  | "active"
  | "trialing"
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

export default function DeleteAccountSection() {
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

  const ACTIVE_LIKE = new Set(["active", "trialing", "past_due", "unpaid"]);
  const isPlanActiveLike = ACTIVE_LIKE.has(planStatus as any);

  // Bloqueia exclusão quando está ativa (ou trial/past_due/unpaid) e NÃO há cancelamento agendado
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
    <section id="delete-account" className="space-y-4 pt-4 border-t">
      <h2 className="text-xl font-semibold text-red-700">Excluir conta</h2>

      {/* Informação quando a renovação já está agendada */}
      {isScheduledForCancellation && (
        <p className="text-sm text-green-800 bg-green-50 p-3 rounded-md">
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
        <p className="text-sm text-yellow-800 bg-yellow-50 p-3 rounded-md">
          Você possui uma assinatura ativa. Para excluir sua conta, primeiro cancele a renovação
          automática na seção de gerenciamento de planos.
        </p>
      )}

      <button
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        onClick={handleClick}
      >
        Excluir minha conta
      </button>

      {/* Modal bloqueado */}
      <AnimatePresence>
        {showBlocked && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowBlocked(false)}
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2">Ação necessária</h3>
              <p className="text-sm text-gray-600 mb-4">
                Para excluir sua conta, primeiro cancele sua assinatura na seção de gerenciamento de
                planos.
              </p>
              <div className="flex justify-end gap-2">
                <button className="px-3 py-1 text-sm" onClick={() => setShowBlocked(false)}>
                  Entendi
                </button>
                <button
                  className="px-3 py-1 text-sm bg-gray-800 text-white rounded hover:bg-gray-900"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2">Tem certeza?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Esta ação é permanente e não pode ser desfeita. Para confirmar, digite{" "}
                <strong>EXCLUIR</strong> no campo abaixo.
              </p>

              {Object.keys(affiliateBalances).length > 0 && (
                <div className="mb-4 text-sm text-yellow-800 bg-yellow-50 p-2 rounded">
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
                className="w-full border p-2 mb-4 rounded-md"
              />
              <div className="flex justify-end gap-2">
                <button className="px-3 py-1 text-sm" onClick={() => setShowConfirm(false)}>
                  Cancelar
                </button>
                <button
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={confirmText !== "EXCLUIR" || isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? "Excluindo..." : "Excluir permanently"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

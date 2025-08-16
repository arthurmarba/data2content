// src/app/dashboard/settings/DeleteAccountSection.tsx
"use client";

import { useState, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

type SessionUser = {
  planStatus?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  planExpiresAt?: string | Date | null;
  affiliateBalances?: Record<string, number> | Map<string, number>;
};

export default function DeleteAccountSection() {
  const { data: session } = useSession();
  const user = (session?.user as SessionUser) || {};
  const planStatus = user.planStatus || "";
  const affiliateBalancesRaw = user.affiliateBalances || {};
  const affiliateBalances =
    affiliateBalancesRaw instanceof Map
      ? Object.fromEntries(affiliateBalancesRaw as Map<string, number>)
      : (affiliateBalancesRaw as Record<string, number>);

  // --- regras de bloqueio alinhadas com o backend ---
  const isScheduledForCancellation = user.cancelAtPeriodEnd === true;
  const ACTIVE_LIKE = new Set(["active", "trialing", "past_due", "unpaid"]);
  const isPlanActiveLike = ACTIVE_LIKE.has(planStatus);
  const isDeletionBlocked = isPlanActiveLike && !isScheduledForCancellation;

  const planExpiresAt: Date | null = useMemo(() => {
    const v = user.planExpiresAt as any;
    if (!v) return null;
    try {
      return v instanceof Date ? v : new Date(v);
    } catch {
      return null;
    }
  }, [user.planExpiresAt]);

  const expiresAtLabel = useMemo(() => {
    if (!planExpiresAt) return null;
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
      }).format(planExpiresAt);
    } catch {
      return planExpiresAt.toLocaleDateString?.() ?? String(planExpiresAt);
    }
  }, [planExpiresAt]);

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

  const hasAffiliateBalance = Object.values(affiliateBalances || {}).some(
    (v) => Number(v) > 0
  );

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

              {hasAffiliateBalance && (
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

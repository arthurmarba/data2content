"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function DeleteAccountSection() {
  const { data: session } = useSession();
  const planStatus = session?.user?.planStatus;
  const affiliateBalances = session?.user?.affiliateBalances || {};
  const hasActive = ["active", "trial", "pending"].includes(planStatus || "");

  const [showBlocked, setShowBlocked] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleClick = () => {
    if (hasActive) setShowBlocked(true); else setShowConfirm(true);
  };

  const scrollToManage = () => {
    setShowBlocked(false);
    const el = document.getElementById("subscription-management-title");
    if (el) el.scrollIntoView({ behavior: "smooth" });
    else window.location.href = "/dashboard/settings#subscription-management-title";
  };

  const handleDelete = async () => {
    const res = await fetch("/api/account/delete", { method: "DELETE" });
    if (res.ok) {
      toast.success("Conta excluída com sucesso.");
      await signOut({ callbackUrl: "/" });
      return;
    }
    const data = await res.json().catch(() => null);
    if (data?.error === "ERR_ACTIVE_SUBSCRIPTION") {
      toast.error("Cancele sua assinatura antes de excluir a conta.");
      setShowConfirm(false);
      setShowBlocked(true);
    } else {
      toast.error(data?.message || "Não foi possível excluir sua conta agora.");
    }
  };

  const hasAffiliateBalance = Object.values(affiliateBalances).some((v) => v > 0);

  return (
    <section id="delete-account" className="space-y-4">
      <h2 className="text-xl font-semibold">Excluir conta</h2>
      {hasActive && (
        <p className="text-sm text-yellow-800 bg-yellow-50 p-3 rounded-md">
          Você possui uma assinatura ativa. Cancele sua assinatura antes de excluir a conta.
        </p>
      )}
      <button
        className="px-4 py-2 bg-red-600 text-white rounded-md disabled:opacity-50"
        onClick={handleClick}
      >
        Excluir conta
      </button>

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
              <h3 className="text-lg font-semibold mb-2">Você precisa cancelar sua assinatura primeiro</h3>
              <p className="text-sm text-gray-600 mb-4">
                Para excluir sua conta, é necessário cancelar sua assinatura antes. Você pode fazer isso em Gerenciar assinatura.
              </p>
              <div className="flex justify-end gap-2">
                <button className="px-3 py-1 text-sm" onClick={() => setShowBlocked(false)}>Entendi</button>
                <button className="px-3 py-1 text-sm bg-brand-dark text-white rounded" onClick={scrollToManage}>Gerenciar assinatura</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2">Excluir conta — ação permanente</h3>
              <p className="text-sm text-gray-600 mb-4">
                Isto vai remover seus dados do Data2Content. Esta ação não pode ser desfeita.
              </p>
              {hasAffiliateBalance && (
                <div className="mb-4 text-sm text-yellow-800 bg-yellow-50 p-2 rounded">
                  {Object.entries(affiliateBalances).map(([cur, val]) => (
                    <div key={cur}>Você tem {val} em {cur}. Considere resgatar antes.</div>
                  ))}
                </div>
              )}
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Digite EXCLUIR"
                className="w-full border p-2 mb-4"
              />
              <div className="flex justify-end gap-2">
                <button className="px-3 py-1 text-sm" onClick={() => setShowConfirm(false)}>Cancelar</button>
                <button
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded disabled:opacity-50"
                  disabled={confirmText !== "EXCLUIR"}
                  onClick={handleDelete}
                >
                  Excluir definitivamente
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}


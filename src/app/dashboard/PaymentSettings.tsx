"use client";

import React, { useState, useEffect, useCallback } from "react";

/**
 * Estrutura mínima para o objeto de "resgate" (redeem).
 */
interface Redemption {
  _id: string;
  amount: number;
  status: string;
  createdAt: string;
}

/**
 * Componente que gerencia os dados de pagamento (Pix/Conta) e exibe
 * o histórico de saques do afiliado, permitindo também solicitar novo saque.
 */
export default function PaymentSettings({ userId }: { userId: string }) {
  // Estados para os dados bancários
  const [pixKey, setPixKey] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Estados para resgate
  const [redeemMessage, setRedeemMessage] = useState("");

  // Histórico de resgates
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  /**
   * Busca os dados de pagamento do usuário.
   */
  const fetchPaymentInfo = useCallback(async () => {
    console.debug("[PaymentSettings] Buscando dados de pagamento para userId =", userId);

    if (!userId) {
      setMessage("Nenhum userId definido. Talvez você não esteja logado?");
      return;
    }

    try {
      const res = await fetch(`/api/affiliate/paymentinfo?userId=${userId}`, {
        credentials: "include",
      });
      const data = await res.json();
      console.debug("[PaymentSettings] Resposta de paymentInfo:", data);

      if (res.ok && !data.error) {
        setPixKey(data.pixKey || "");
        setBankName(data.bankName || "");
        setBankAgency(data.bankAgency || "");
        setBankAccount(data.bankAccount || "");
      } else {
        setMessage(data.error || "Erro ao buscar dados de pagamento.");
      }
    } catch (error) {
      console.error("[PaymentSettings] Erro ao buscar paymentInfo:", error);
      setMessage("Ocorreu um erro ao buscar dados de pagamento.");
    }
  }, [userId]);

  /**
   * Busca o histórico de resgates do usuário.
   */
  const fetchRedemptions = useCallback(async () => {
    setLoadingRedemptions(true);
    if (!userId) {
      setRedeemMessage("Nenhum userId definido. Talvez você não esteja logado?");
      setLoadingRedemptions(false);
      return;
    }

    try {
      const res = await fetch(`/api/affiliate/redeem?userId=${userId}`, {
        credentials: "include",
      });
      const data = await res.json();
      console.debug("[PaymentSettings] Resposta de redemptions:", data);
      if (Array.isArray(data)) {
        setRedemptions(data);
      } else if (data.error) {
        setRedeemMessage(data.error);
      }
    } catch (error) {
      console.error("[PaymentSettings] Erro ao buscar redemptions:", error);
      setRedeemMessage("Ocorreu um erro ao buscar histórico de saques.");
    } finally {
      setLoadingRedemptions(false);
    }
  }, [userId]);

  // Chama as funções de fetch ao montar ou quando o userId mudar
  useEffect(() => {
    if (!userId) {
      console.warn("[PaymentSettings] userId vazio. Abortando fetch.");
      return;
    }
    void fetchPaymentInfo();
    void fetchRedemptions();
  }, [userId, fetchPaymentInfo, fetchRedemptions]);

  /**
   * Salva os dados de pagamento (PATCH).
   */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    if (!userId) {
      setMessage("Nenhum userId definido. Não é possível salvar.");
      setSaving(false);
      return;
    }

    try {
      console.debug("[PaymentSettings] Enviando PATCH para salvar dados...");
      const res = await fetch("/api/affiliate/paymentinfo", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          pixKey,
          bankName,
          bankAgency,
          bankAccount,
        }),
      });
      const data = await res.json();
      console.debug("[PaymentSettings] Resposta do PATCH:", data);
      if (res.ok && !data.error) {
        setMessage(data.message || "Dados salvos com sucesso!");
      } else {
        setMessage(data.error || "Erro ao salvar dados de pagamento.");
      }
    } catch (error) {
      console.error("[PaymentSettings] Erro no handleSave:", error);
      setMessage("Ocorreu um erro ao salvar dados de pagamento.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Solicita o resgate do saldo (POST).
   */
  async function handleRedeem() {
    setRedeemMessage("Processando resgate...");
    if (!userId) {
      setRedeemMessage("Nenhum userId definido. Não é possível resgatar.");
      return;
    }

    try {
      console.debug("[PaymentSettings] Enviando POST para resgatar saldo...");
      const res = await fetch("/api/affiliate/redeem", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      console.debug("[PaymentSettings] Resposta do resgate:", data);
      if (res.ok && !data.error) {
        setRedeemMessage(data.message || "Resgate solicitado com sucesso!");
        void fetchRedemptions(); // Atualiza o histórico de saques
      } else {
        setRedeemMessage(data.error || "Erro ao solicitar resgate.");
      }
    } catch (error) {
      console.error("[PaymentSettings] Erro no handleRedeem:", error);
      setRedeemMessage("Ocorreu um erro ao processar o resgate.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Formulário de dados bancários */}
      <form onSubmit={handleSave} className="border border-gray-200 p-4 rounded">
        <h3 className="text-sm font-semibold mb-3">Seus Dados de Pagamento</h3>

        <label className="block mb-2 text-xs font-medium text-gray-700">
          Chave Pix
          <input
            type="text"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>

        <label className="block mb-2 text-xs font-medium text-gray-700">
          Banco
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>

        <label className="block mb-2 text-xs font-medium text-gray-700">
          Agência
          <input
            type="text"
            value={bankAgency}
            onChange={(e) => setBankAgency(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>

        <label className="block mb-2 text-xs font-medium text-gray-700">
          Conta
          <input
            type="text"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>

        {message && <p className="text-xs text-blue-600 mt-2">{message}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-3 px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
        >
          {saving ? "Salvando..." : "Salvar Dados"}
        </button>
      </form>

      {/* Botão para solicitar resgate */}
      <div>
        <button
          onClick={handleRedeem}
          className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
        >
          Resgatar Saldo
        </button>
        {redeemMessage && (
          <p className="text-xs text-blue-600 mt-2">{redeemMessage}</p>
        )}
      </div>

      {/* Histórico de Saques */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Histórico de Resgates</h3>
        {loadingRedemptions ? (
          <p className="text-xs text-gray-500">Carregando saques...</p>
        ) : redemptions.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhum saque realizado ainda.</p>
        ) : (
          <table className="w-full text-xs border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 text-left">Data</th>
                <th className="px-2 py-1 text-left">Valor</th>
                <th className="px-2 py-1 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => (
                <tr key={r._id}>
                  <td className="px-2 py-1">
                    {new Date(r.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-2 py-1">R${r.amount.toFixed(2)}</td>
                  <td className="px-2 py-1 capitalize">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

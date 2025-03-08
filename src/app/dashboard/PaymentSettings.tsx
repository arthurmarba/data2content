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
 * o histórico de saques do afiliado. Permite também solicitar novo saque.
 */
export default function PaymentSettings({ userId }: { userId: string }) {
  // Campos de pagamento
  const [pixKey, setPixKey] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Resgate
  const [redeemMessage, setRedeemMessage] = useState("");

  // Histórico de saques
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  /**
   * Função para buscar dados de pagamento (Pix, conta, etc.).
   * É memorizada com useCallback, dependendo de userId.
   */
  const fetchPaymentInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/affiliate/paymentinfo?userId=${userId}`);
      const data = await res.json();
      if (!data.error) {
        setPixKey(data.pixKey || "");
        setBankName(data.bankName || "");
        setBankAgency(data.bankAgency || "");
        setBankAccount(data.bankAccount || "");
      }
    } catch (error) {
      console.error("Erro ao buscar paymentInfo:", error);
    }
  }, [userId]);

  /**
   * Função para listar os saques do usuário.
   * Também memorizada com useCallback, dependendo de userId.
   */
  const fetchRedemptions = useCallback(async () => {
    setLoadingRedemptions(true);
    try {
      const res = await fetch(`/api/affiliate/redeem?userId=${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRedemptions(data);
      }
    } catch (error) {
      console.error("Erro ao buscar redemptions:", error);
    } finally {
      setLoadingRedemptions(false);
    }
  }, [userId]);

  /**
   * useEffect para chamar as duas funções após o componente montar
   * ou quando userId mudar. Agora adicionamos fetchPaymentInfo e fetchRedemptions
   * no array de dependências para obedecer ao lint (react-hooks/exhaustive-deps).
   */
  useEffect(() => {
    if (!userId) return;
    void fetchPaymentInfo();
    void fetchRedemptions();
  }, [userId, fetchPaymentInfo, fetchRedemptions]);

  /**
   * Salva dados de pagamento (PATCH).
   */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/affiliate/paymentinfo", {
        method: "PATCH",
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
      if (data.error) {
        setMessage(`Erro: ${data.error}`);
      } else {
        setMessage(data.message || "Dados salvos com sucesso!");
      }
    } catch (error) {
      let errorMsg = "Ocorreu um erro.";
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      setMessage(`Ocorreu um erro: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Solicita resgate do saldo (POST).
   */
  async function handleRedeem() {
    setRedeemMessage("Processando resgate...");
    try {
      const res = await fetch("/api/affiliate/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.error) {
        setRedeemMessage(`Erro: ${data.error}`);
      } else {
        setRedeemMessage(data.message || "Resgate solicitado com sucesso!");
        // Recarrega lista de saques
        void fetchRedemptions();
      }
    } catch (error) {
      let errorMsg = "Ocorreu um erro.";
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      setRedeemMessage(`Ocorreu um erro: ${errorMsg}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Formulário para dados bancários */}
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

      {/* Botão para solicitar saque */}
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

      {/* Lista de saques (redemptions) */}
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

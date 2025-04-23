"use client";

import React, { useState, useEffect, useCallback } from "react";
// Importando ícones para feedback e loading
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaInfoCircle } from "react-icons/fa";
// Importando Framer Motion para animações
import { motion, AnimatePresence } from "framer-motion";

/**
 * Estrutura mínima para o objeto de "resgate" (redeem).
 */
interface Redemption {
  _id: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | string; // Tipos comuns de status
  createdAt: string;
  // Adicione outros campos se a API retornar (ex: transactionId, paidAt)
}

/** Props para o componente PaymentSettings */
interface PaymentSettingsProps {
  userId: string;
  // TODO: Considerar passar o saldo disponível como prop para exibir contexto ao botão de resgate
  // availableBalance?: number;
}

// Componente auxiliar para mensagens de feedback
const FeedbackMessage = ({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) => {
  const iconMap = {
    success: <FaCheckCircle className="text-green-500" />,
    error: <FaTimesCircle className="text-red-500" />,
    info: <FaInfoCircle className="text-blue-500" />,
  };
  const colorMap = {
    success: 'text-green-600 bg-green-50 border-green-200',
    error: 'text-red-600 bg-red-50 border-red-200',
    info: 'text-blue-600 bg-blue-50 border-blue-200',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex items-center gap-2 text-xs font-medium p-2 rounded border ${colorMap[type]} mt-2`}
    >
      {iconMap[type]}
      <span>{message}</span>
    </motion.div>
  );
};

// Componente auxiliar para Badges de Status
const StatusBadge = ({ status }: { status: string }) => {
    let colorClasses = 'bg-gray-100 text-gray-600 border-gray-300'; // Padrão
    let text = status.charAt(0).toUpperCase() + status.slice(1); // Capitaliza

    switch (status.toLowerCase()) {
        case 'paid':
        case 'pago':
            colorClasses = 'bg-green-100 text-green-700 border-green-300';
            text = 'Pago';
            break;
        case 'pending':
        case 'pendente':
            colorClasses = 'bg-yellow-100 text-yellow-700 border-yellow-300';
            text = 'Pendente';
            break;
        case 'failed':
        case 'falhou':
        case 'recusado':
            colorClasses = 'bg-red-100 text-red-700 border-red-300';
            text = 'Falhou';
            break;
    }

    return (
        <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${colorClasses}`}>
            {text}
        </span>
    );
};


/**
 * Componente que gerencia os dados de pagamento (Pix/Conta) e exibe
 * o histórico de saques do afiliado, permitindo também solicitar novo saque.
 * (Versão com melhorias de UX/UI)
 */
export default function PaymentSettings({ userId }: PaymentSettingsProps) {
  // Estados para os dados bancários
  const [pixKey, setPixKey] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [saveStatus, setSaveStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSaving, setIsSaving] = useState(false); // Renomeado de 'saving'

  // Estados para resgate
  const [redeemStatus, setRedeemStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false); // Novo estado para loading do resgate

  // Histórico de resgates
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  /**
   * Busca os dados de pagamento do usuário.
   */
  const fetchPaymentInfo = useCallback(async () => {
    console.debug("[PaymentSettings] Buscando dados de pagamento para userId =", userId);
    setSaveStatus(null); // Limpa status ao buscar
    if (!userId) {
      setSaveStatus({ message: "ID do usuário não encontrado.", type: 'error' });
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
        setSaveStatus({ message: data.error || "Erro ao buscar dados de pagamento.", type: 'error' });
      }
    } catch (error) {
      console.error("[PaymentSettings] Erro ao buscar paymentInfo:", error);
      setSaveStatus({ message: "Ocorreu um erro de rede ao buscar dados.", type: 'error' });
    }
  }, [userId]);

  /**
   * Busca o histórico de resgates do usuário.
   */
  const fetchRedemptions = useCallback(async () => {
    setLoadingRedemptions(true);
    setRedeemStatus(null); // Limpa status ao buscar
    if (!userId) {
      setRedeemStatus({ message: "ID do usuário não encontrado.", type: 'error' });
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
        setRedeemStatus({ message: data.error, type: 'error' });
        setRedemptions([]); // Limpa em caso de erro
      } else {
         setRedemptions([]); // Limpa se a resposta não for array
      }
    } catch (error) {
      console.error("[PaymentSettings] Erro ao buscar redemptions:", error);
      setRedeemStatus({ message: "Ocorreu um erro de rede ao buscar histórico.", type: 'error' });
       setRedemptions([]); // Limpa em caso de erro
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
    setIsSaving(true);
    setSaveStatus(null);
    if (!userId) {
      setSaveStatus({ message: "ID do usuário não encontrado.", type: 'error' });
      setIsSaving(false);
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
        setSaveStatus({ message: data.message || "Dados salvos com sucesso!", type: 'success' });
      } else {
        setSaveStatus({ message: data.error || "Erro ao salvar dados.", type: 'error' });
      }
    } catch (error) {
      console.error("[PaymentSettings] Erro no handleSave:", error);
      setSaveStatus({ message: "Ocorreu um erro de rede ao salvar.", type: 'error' });
    } finally {
      setIsSaving(false);
      // Limpa mensagem de sucesso após um tempo
      if (saveStatus?.type === 'success') {
          setTimeout(() => setSaveStatus(null), 4000);
      }
    }
  }

  /**
   * Solicita o resgate do saldo (POST).
   */
  async function handleRedeem() {
    setIsRedeeming(true); // Inicia loading do resgate
    setRedeemStatus(null);
    if (!userId) {
      setRedeemStatus({ message: "ID do usuário não encontrado.", type: 'error' });
      setIsRedeeming(false);
      return;
    }

    try {
      console.debug("[PaymentSettings] Enviando POST para resgatar saldo...");
      const res = await fetch("/api/affiliate/redeem", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }), // A API deve verificar o saldo e dados bancários
      });
      const data = await res.json();
      console.debug("[PaymentSettings] Resposta do resgate:", data);
      if (res.ok && !data.error) {
        setRedeemStatus({ message: data.message || "Resgate solicitado com sucesso!", type: 'success' });
        void fetchRedemptions(); // Atualiza o histórico de saques
        // TODO: Atualizar o saldo disponível (se exibido aqui ou no componente pai)
      } else {
        setRedeemStatus({ message: data.error || "Erro ao solicitar resgate.", type: 'error' });
      }
    } catch (error) {
      console.error("[PaymentSettings] Erro no handleRedeem:", error);
      setRedeemStatus({ message: "Ocorreu um erro de rede ao processar o resgate.", type: 'error' });
    } finally {
      setIsRedeeming(false); // Finaliza loading do resgate
       // Limpa mensagem de sucesso após um tempo
      if (redeemStatus?.type === 'success') {
          setTimeout(() => setRedeemStatus(null), 4000);
      }
    }
  }

  return (
    // Container principal com espaçamento vertical
    <div className="space-y-8">

      {/* Formulário de dados bancários */}
      <form onSubmit={handleSave} className="border border-gray-200 p-4 sm:p-6 rounded-lg shadow-sm bg-white">
        <h3 className="text-lg font-semibold mb-4 text-brand-dark">Seus Dados de Pagamento</h3>

        {/* Agrupamento dos campos */}
        <div className="space-y-4">
            {/* Chave Pix */}
            <div>
                <label htmlFor="pixKey" className="block text-sm font-medium text-gray-700 mb-1">
                Chave Pix (Recomendado)
                </label>
                <input
                    id="pixKey"
                    type="text"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    disabled={isSaving}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-brand-pink focus:border-brand-pink transition disabled:opacity-50 disabled:bg-gray-50"
                    placeholder="Email, CPF/CNPJ, Telefone ou Chave Aleatória"
                />
            </div>

            {/* Divisor ou texto */}
             <div className="relative my-4">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                    <span className="bg-white px-2 text-xs text-gray-500">OU</span>
                </div>
            </div>

            {/* Dados Bancários */}
            <div className="space-y-4 p-4 border border-gray-200 rounded-md bg-gray-50/50">
                 <h4 className="text-sm font-medium text-gray-600 mb-2">Conta Bancária (Opcional)</h4>
                 <div>
                    <label htmlFor="bankName" className="block text-xs font-medium text-gray-700 mb-1">
                    Nome do Banco
                    </label>
                    <input
                        id="bankName"
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        disabled={isSaving}
                        className="block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm shadow-sm focus:ring-1 focus:ring-brand-pink focus:border-brand-pink transition disabled:opacity-50 disabled:bg-gray-50"
                        placeholder="Ex: Banco do Brasil, Nubank"
                    />
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="bankAgency" className="block text-xs font-medium text-gray-700 mb-1">
                        Agência (sem dígito)
                        </label>
                        <input
                            id="bankAgency"
                            type="text"
                            inputMode="numeric" // Ajuda em teclados mobile
                            value={bankAgency}
                            onChange={(e) => setBankAgency(e.target.value.replace(/\D/g, ''))} // Permite apenas números
                            disabled={isSaving}
                            className="block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm shadow-sm focus:ring-1 focus:ring-brand-pink focus:border-brand-pink transition disabled:opacity-50 disabled:bg-gray-50"
                            placeholder="Ex: 1234"
                        />
                    </div>
                    <div>
                        <label htmlFor="bankAccount" className="block text-xs font-medium text-gray-700 mb-1">
                        Conta Corrente (com dígito)
                        </label>
                        <input
                            id="bankAccount"
                            type="text"
                            value={bankAccount}
                            onChange={(e) => setBankAccount(e.target.value)} // Pode precisar de máscara/validação
                            disabled={isSaving}
                            className="block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm shadow-sm focus:ring-1 focus:ring-brand-pink focus:border-brand-pink transition disabled:opacity-50 disabled:bg-gray-50"
                            placeholder="Ex: 12345-6"
                        />
                    </div>
                 </div>
            </div>
        </div>

        {/* Feedback de Salvamento */}
        <AnimatePresence>
            {saveStatus && <FeedbackMessage message={saveStatus.message} type={saveStatus.type} />}
        </AnimatePresence>

        {/* Botão Salvar */}
        <button
          type="submit"
          disabled={isSaving}
          // Estilo consistente com outros botões primários
          className="mt-5 px-5 py-2 bg-brand-pink text-white text-sm font-semibold rounded-full hover:opacity-90 transition-default disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <FaSpinner className="animate-spin w-4 h-4" />
              <span>Salvando...</span>
            </>
          ) : (
            "Salvar Dados"
          )}
        </button>
      </form>

      {/* Seção de Resgate */}
      {/* TODO: Decidir se esta seção fica aqui ou no card de afiliados */}
      <div className="border border-gray-200 p-4 sm:p-6 rounded-lg shadow-sm bg-white">
         <h3 className="text-lg font-semibold mb-4 text-brand-dark">Solicitar Resgate</h3>
         {/* TODO: Exibir saldo disponível aqui */}
         {/* <p className="text-sm text-gray-600 mb-4">Saldo disponível: R$ {availableBalance?.toFixed(2) ?? '0.00'}</p> */}
         <p className="text-xs text-gray-500 mb-4">O valor mínimo para resgate é R$ XX,XX. O pagamento será processado em até X dias úteis.</p>

         <button
          onClick={handleRedeem}
          disabled={isRedeeming} // Desabilita durante o resgate
          // Estilo consistente (talvez verde para diferenciar?)
          className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-full hover:bg-green-700 transition-default disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
         >
          {isRedeeming ? (
            <>
              <FaSpinner className="animate-spin w-4 h-4" />
              <span>Processando...</span>
            </>
          ) : (
            "Resgatar Saldo Disponível"
          )}
        </button>

        {/* Feedback de Resgate */}
        <AnimatePresence>
            {redeemStatus && <FeedbackMessage message={redeemStatus.message} type={redeemStatus.type} />}
        </AnimatePresence>
      </div>


      {/* Histórico de Saques */}
      <div className="border border-gray-200 p-4 sm:p-6 rounded-lg shadow-sm bg-white">
        <h3 className="text-lg font-semibold mb-4 text-brand-dark">Histórico de Resgates</h3>
        {loadingRedemptions ? (
          <div className="flex items-center justify-center text-sm text-gray-500 py-4">
             <FaSpinner className="animate-spin w-5 h-5 mr-2" />
             Carregando histórico...
          </div>
        ) : redemptions.length === 0 ? (
          <p className="text-sm text-center text-gray-500 py-4">Nenhum resgate realizado ainda.</p>
        ) : (
          // Tabela com melhorias de estilo
          // TODO: Considerar layout de cards para mobile se a tabela ficar muito larga
          <div className="overflow-x-auto">
             <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-50">
                <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Data</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Valor (R$)</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200">Status</th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                {redemptions.map((r) => (
                    <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 text-gray-700">
                        {new Date(r.createdAt).toLocaleString("pt-BR", { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{r.amount.toFixed(2)}</td>
                    <td className="px-3 py-2">
                        <StatusBadge status={r.status} />
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

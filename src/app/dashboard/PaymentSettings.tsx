// src/app/dashboard/PaymentSettings.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
// Importando ícones para feedback e loading
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaInfoCircle } from "react-icons/fa";
// Importando Framer Motion para animações
import { motion, AnimatePresence } from "framer-motion";
// Importando useSession para atualizar o saldo
import { useSession } from "next-auth/react";

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
}

// Interface para a resposta da API de resgate
interface RedeemApiResponse {
    message?: string;
    error?: string;
    redemption?: any; // Detalhes do resgate criado
 }

// Interface para a resposta da API de busca de dados de pagamento
interface PaymentInfoApiResponse {
    paymentInfo?: {
        pixKey?: string;
        bankName?: string;
        bankAgency?: string;
        bankAccount?: string;
        stripeAccountId?: string | null;
        stripeAccountStatus?: string | null;
    };
    error?: string;
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
 */
function fmt(amountCents:number, cur:string){
  const n = amountCents/100;
  const locale = cur === 'brl' ? 'pt-BR' : 'en-US';
  return new Intl.NumberFormat(locale,{style:'currency',currency:cur.toUpperCase()}).format(n);
}

export default function PaymentSettings({ userId }: PaymentSettingsProps) {
  // Hook useSession para atualizar dados
  const { data: session, update: updateSession } = useSession();
  const balances: Record<string, number> = session?.user?.affiliateBalances || {};
  const currencyOptions = Object.entries(balances).filter(([,c])=>c>0);
  const [selectedCurrency, setSelectedCurrency] = useState(currencyOptions[0]?.[0] || 'brl');
  const availableBalance = balances[selectedCurrency] ? balances[selectedCurrency]/100 : 0;

  // Estados para os dados bancários
  const [pixKey, setPixKey] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [saveStatus, setSaveStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para resgate (agora usando 'idle', 'processing', etc.)
  const [redeemMessage, setRedeemMessage] = useState("");
  const [redeemStatusState, setRedeemStatusState] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  // Histórico de resgates
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [stripeAccountStatus, setStripeAccountStatus] = useState<string | null>(null);

  const openStripeDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/affiliate/connect/login-link', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, '_blank');
      } else {
        console.error(data.error || 'Falha ao gerar link');
      }
    } catch (error) {
      console.error('[PaymentSettings] Erro ao abrir painel do Stripe:', error);
    }
  }, []);

  /**
   * Busca os dados de pagamento do usuário.
   * <<< CORRIGIDO para ler data.paymentInfo >>>
   */
  const fetchPaymentInfo = useCallback(async () => {
    console.debug("[PaymentSettings] Buscando dados de pagamento para userId =", userId);
    setSaveStatus(null);
    if (!userId) {
      setSaveStatus({ message: "ID do usuário não encontrado.", type: 'error' });
      return;
    }

    try {
      const res = await fetch(`/api/affiliate/paymentinfo?userId=${userId}`, {
        credentials: "include",
      });
      // Define o tipo esperado da resposta da API
      const data: PaymentInfoApiResponse = await res.json();
      console.debug("[PaymentSettings] Resposta de paymentInfo:", data);

      // Verifica se a resposta está OK e se existe o objeto paymentInfo
      if (res.ok && data.paymentInfo) {
        // <<< CORREÇÃO: Acessa os dados dentro de data.paymentInfo >>>
        setPixKey(data.paymentInfo.pixKey || "");
        setBankName(data.paymentInfo.bankName || "");
        setBankAgency(data.paymentInfo.bankAgency || "");
        setBankAccount(data.paymentInfo.bankAccount || "");
        setStripeAccountId(data.paymentInfo.stripeAccountId || null);
        setStripeAccountStatus(data.paymentInfo.stripeAccountStatus || null);
      } else {
         // Não mostra erro se apenas não encontrou dados (status 404)
         if (res.status !== 404) {
             setSaveStatus({ message: data.error || "Erro ao buscar dados de pagamento.", type: 'error' });
         }
         console.warn("Dados de pagamento não encontrados ou erro:", data.error || res.status);
         // Garante que os campos fiquem vazios se não houver dados
         setPixKey("");
         setBankName("");
         setBankAgency("");
         setBankAccount("");
         setStripeAccountId(null);
         setStripeAccountStatus(null);
      }
    } catch (error) {
      console.error("[PaymentSettings] Erro ao buscar paymentInfo:", error);
      setSaveStatus({ message: "Ocorreu um erro de rede ao buscar dados.", type: 'error' });
    }
  }, [userId]); // Mantém userId como dependência

  /**
   * Busca o histórico de resgates do usuário.
   */
  const fetchRedemptions = useCallback(async () => {
    setLoadingRedemptions(true);
    setRedeemMessage(""); // Limpa mensagem de resgate ao buscar histórico
    setRedeemStatusState('idle'); // Reseta estado do resgate
    if (!userId) {
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
         console.error("Erro ao buscar histórico:", data.error);
        setRedemptions([]);
      } else {
         setRedemptions([]);
      }
    } catch (error) {
      console.error("[PaymentSettings] Erro ao buscar redemptions:", error);
       setRedemptions([]);
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
        // Limpa mensagem de sucesso após um tempo
        setTimeout(() => {
            // Verifica se o estado ainda é de sucesso antes de limpar
            setSaveStatus(prev => (prev?.type === 'success' ? null : prev));
        }, 4000);
      } else {
        setSaveStatus({ message: data.error || "Erro ao salvar dados.", type: 'error' });
      }
    } catch (error) {
      console.error("[PaymentSettings] Erro no handleSave:", error);
      setSaveStatus({ message: "Ocorreu um erro de rede ao salvar.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Solicita o resgate do saldo (POST).
   * Lógica já alinhada com MainDashboard.
   */
  const handleRedeem = useCallback(async () => {
     if (!userId) {
        setRedeemMessage("Erro: ID do usuário não encontrado.");
        setRedeemStatusState('error');
        return;
     }

     setRedeemMessage(""); // Limpa mensagem anterior
     setRedeemStatusState('processing'); // Define como processando

     try {
        const response = await fetch('/api/affiliate/redeem', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, currency: selectedCurrency }),
        });

        const data: RedeemApiResponse = await response.json();

        if (!response.ok) {
            setRedeemMessage(data.error || `Erro ${response.status}: Falha ao solicitar resgate.`);
            setRedeemStatusState('error');
            console.error("Erro da API de resgate:", data.error || response.statusText);
            setTimeout(() => {
                setRedeemStatusState(prev => (prev === 'error' ? 'idle' : prev));
                setRedeemMessage(prevMsg => (redeemStatusState === 'error' ? "" : prevMsg)); // Limpa msg só se ainda for erro
            }, 5000);
            return;
        }

        // Sucesso!
        setRedeemMessage("Solicitação enviada! O pagamento será processado manualmente em até 72 horas.");
        setRedeemStatusState('success');
        setTimeout(() => {
             setRedeemStatusState(prev => (prev === 'success' ? 'idle' : prev));
             setRedeemMessage(prevMsg => (redeemStatusState === 'success' ? "" : prevMsg)); // Limpa msg só se ainda for sucesso
        }, 7000);

        // Atualiza sessão e histórico
        await updateSession();
        void fetchRedemptions();

    } catch (error: unknown) {
        console.error("[handleRedeem - PaymentSettings] Erro no fetch:", error);
        const message = error instanceof Error ? error.message : "Erro inesperado ao conectar com o servidor.";
        setRedeemMessage(`Erro: ${message}`);
        setRedeemStatusState('error');
         setTimeout(() => {
             setRedeemStatusState(prev => (prev === 'error' ? 'idle' : prev));
             setRedeemMessage(prevMsg => (redeemStatusState === 'error' ? "" : prevMsg));
        }, 5000);
    }
   // Adiciona saveStatus como dependência para evitar stale closure nos setTimeouts
   }, [userId, fetchRedemptions, updateSession, redeemStatusState, saveStatus, selectedCurrency]);

   // Condição para habilitar o botão de resgate no modal
   const canRedeemModal = availableBalance > 0 && redeemStatusState !== 'processing';

  return (
    // Container principal com espaçamento vertical
    <div className="space-y-8">
      {stripeAccountId && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openStripeDashboard}
            className="px-4 py-2 bg-black text-white rounded-md text-sm hover:opacity-90"
          >
            Abrir painel do Stripe
          </button>
        </div>
      )}

      {/* Formulário de dados bancários */}
      <form onSubmit={handleSave} className="border border-gray-200 p-4 sm:p-6 rounded-lg shadow-sm bg-white">
         {/* ... (campos do formulário mantidos como antes) ... */}
          <h3 className="text-lg font-semibold mb-4 text-brand-dark">Seus Dados de Pagamento</h3>
        <div className="space-y-4">
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
             <div className="relative my-4">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                    <span className="bg-white px-2 text-xs text-gray-500">OU</span>
                </div>
            </div>
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
                            inputMode="numeric"
                            value={bankAgency}
                            onChange={(e) => setBankAgency(e.target.value.replace(/\D/g, ''))}
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
                            onChange={(e) => setBankAccount(e.target.value)}
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
          className="mt-5 px-5 py-2 bg-brand-pink text-white text-sm font-semibold rounded-full hover:opacity-90 transition-default disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <> <FaSpinner className="animate-spin w-4 h-4" /> <span>Salvando...</span> </>
          ) : ( "Salvar Dados" )}
        </button>
      </form>

      {/* Seção de Resgate */}
      <div className="border border-gray-200 p-4 sm:p-6 rounded-lg shadow-sm bg-white">
         <h3 className="text-lg font-semibold mb-2 text-brand-dark">Solicitar Resgate</h3>
         <div className="mb-4 flex items-center gap-2">
           <select value={selectedCurrency} onChange={e=>setSelectedCurrency(e.target.value)} className="rounded border px-2 py-1 text-sm">
             {currencyOptions.map(([cur]) => (
               <option key={cur} value={cur}>{cur.toUpperCase()}</option>
             ))}
           </select>
           <span className="text-sm text-gray-600">Saldo: <strong className="text-green-600">{fmt(balances[selectedCurrency]||0, selectedCurrency)}</strong></span>
         </div>
         <p className="text-xs text-gray-500 mb-4">O pagamento será processado manualmente em até 72 horas após a solicitação.</p>

         {/* Botão de Resgate Atualizado */}
         <button
          onClick={handleRedeem}
          disabled={!canRedeemModal}
          className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-full hover:bg-green-700 transition-default disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
         >
          {redeemStatusState === 'processing' ? (
            <> <FaSpinner className="animate-spin w-4 h-4" /> <span>Processando...</span> </>
          ) : ( "Resgatar" )}
        </button>

        {/* Feedback de Resgate */}
        <AnimatePresence>
            {redeemMessage && (
                 <FeedbackMessage
                    message={redeemMessage}
                    type={redeemStatusState === 'error' ? 'error' : redeemStatusState === 'success' ? 'success' : 'info'}
                 />
            )}
        </AnimatePresence>
      </div>


      {/* Histórico de Saques */}
      <div className="border border-gray-200 p-4 sm:p-6 rounded-lg shadow-sm bg-white">
        {/* ... (código do histórico mantido como antes) ... */}
        <h3 className="text-lg font-semibold mb-4 text-brand-dark">Histórico de Resgates</h3>
        {loadingRedemptions ? (
          <div className="flex items-center justify-center text-sm text-gray-500 py-4">
             <FaSpinner className="animate-spin w-5 h-5 mr-2" />
             Carregando histórico...
          </div>
        ) : redemptions.length === 0 ? (
          <p className="text-sm text-center text-gray-500 py-4">Nenhum resgate realizado ainda.</p>
        ) : (
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

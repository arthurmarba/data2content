// src/app/admin/redemptions/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
// Importando ícones
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaUserCircle, FaCopy, FaExternalLinkAlt } from "react-icons/fa";
// Importando Framer Motion para animações
import { motion, AnimatePresence } from "framer-motion";

// --- Adicionado para forçar renderização dinâmica ---
export const dynamic = 'force-dynamic';
// ----------------------------------------------------

// --- Interfaces ---
interface PaymentInfo {
  pixKey?: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
}

interface UserInfo {
  _id: string;
  name?: string;
  email?: string;
  paymentInfo?: PaymentInfo;
}

interface RedemptionAdmin {
  _id: string;
  user: UserInfo; // Agora populado com dados do usuário
  amount: number;
  status: "pending" | "paid" | "canceled";
  createdAt: string; // Mantido como string, pois vem do JSON
  updatedAt: string; // Mantido como string, pois vem do JSON
  notes?: string; // Adicionado para possível uso futuro
}

// Tipo para o estado de atualização
type UpdateStatus = {
    [key: string]: 'idle' | 'loading' | 'success' | 'error';
};

// --- Componentes Auxiliares ---

// Badge de Status (Reutilizado e adaptado)
const StatusBadge = ({ status }: { status: string }) => {
    let colorClasses = 'bg-gray-100 text-gray-600 border-gray-300';
    let text = status.charAt(0).toUpperCase() + status.slice(1);

    switch (status.toLowerCase()) {
        case 'paid': colorClasses = 'bg-green-100 text-green-700 border-green-300'; text = 'Pago'; break;
        case 'pending': colorClasses = 'bg-yellow-100 text-yellow-700 border-yellow-300'; text = 'Pendente'; break;
        case 'canceled': colorClasses = 'bg-red-100 text-red-700 border-red-300'; text = 'Cancelado'; break;
    }
    return <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${colorClasses}`}>{text}</span>;
};

// Feedback Message (Reutilizado)
const FeedbackMessage = ({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) => {
  const iconMap = { success: <FaCheckCircle className="text-green-500" />, error: <FaTimesCircle className="text-red-500" />, info: <FaExclamationTriangle className="text-yellow-500" /> };
  const colorMap = { success: 'text-green-600 bg-green-50 border-green-200', error: 'text-red-600 bg-red-50 border-red-200', info: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
  return ( <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`flex items-center gap-2 text-sm font-medium p-3 rounded border ${colorMap[type]} my-4`} > {iconMap[type]} <span>{message}</span> </motion.div> );
};

// Componente para exibir dados de pagamento de forma organizada
const PaymentDetails = ({ paymentInfo }: { paymentInfo?: PaymentInfo }) => {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copyToClipboard = (text: string | undefined, keyType: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedKey(keyType);
            setTimeout(() => setCopiedKey(null), 1500);
        }).catch(err => console.error('Erro ao copiar:', err));
    };

    if (!paymentInfo || (!paymentInfo.pixKey && !paymentInfo.bankName)) {
        return <span className="text-xs text-gray-400 italic">Dados não preenchidos</span>;
    }

    return (
        <div className="text-xs space-y-1">
            {paymentInfo.pixKey && (
                <div className="flex items-center gap-1">
                    <strong className="text-gray-600">Pix:</strong>
                    <span className="font-mono bg-gray-100 px-1 rounded text-gray-700 break-all">{paymentInfo.pixKey}</span>
                    <button onClick={() => copyToClipboard(paymentInfo.pixKey, 'pix')} title="Copiar Chave Pix" className="ml-1 text-gray-400 hover:text-brand-pink">
                        {copiedKey === 'pix' ? <FaCheckCircle className="w-3 h-3 text-green-500"/> : <FaCopy className="w-3 h-3"/>}
                    </button>
                </div>
            )}
            {paymentInfo.bankName && (
                <div className="flex items-center gap-1">
                    <strong className="text-gray-600">Banco:</strong>
                    <span className="text-gray-700">{paymentInfo.bankName}</span>
                </div>
            )}
            {paymentInfo.bankAgency && (
                 <div className="flex items-center gap-1">
                    <strong className="text-gray-600">Ag:</strong>
                    <span className="font-mono text-gray-700">{paymentInfo.bankAgency}</span>
                     <button onClick={() => copyToClipboard(paymentInfo.bankAgency, 'ag')} title="Copiar Agência" className="ml-1 text-gray-400 hover:text-brand-pink">
                        {copiedKey === 'ag' ? <FaCheckCircle className="w-3 h-3 text-green-500"/> : <FaCopy className="w-3 h-3"/>}
                    </button>
                </div>
            )}
            {paymentInfo.bankAccount && (
                 <div className="flex items-center gap-1">
                    <strong className="text-gray-600">CC:</strong>
                    <span className="font-mono text-gray-700">{paymentInfo.bankAccount}</span>
                     <button onClick={() => copyToClipboard(paymentInfo.bankAccount, 'cc')} title="Copiar Conta" className="ml-1 text-gray-400 hover:text-brand-pink">
                        {copiedKey === 'cc' ? <FaCheckCircle className="w-3 h-3 text-green-500"/> : <FaCopy className="w-3 h-3"/>}
                    </button>
                </div>
            )}
        </div>
    );
};


// --- Componente Principal da Página ---
export default function AdminRedemptionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [redemptions, setRedemptions] = useState<RedemptionAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'paid' | 'canceled' | 'all'>('pending');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({}); // Estado para botões de ação

  // Verifica se o usuário é admin
  const isAdmin = useMemo(() => session?.user?.role === 'admin', [session]);

  // Redireciona se não for admin ou não estiver autenticado
  useEffect(() => {
    if (status === 'loading') return; // Espera carregar a sessão
    if (status === 'unauthenticated' || !isAdmin) {
      router.replace('/'); // Redireciona para home ou página de login
    }
  }, [status, isAdmin, router]);

  // Função para buscar os resgates
  const fetchRedemptions = useCallback(async (statusFilter: string) => {
    // Só executa a busca se for admin
    if (!isAdmin) {
        setIsLoading(false); // Garante que o loading para se a verificação de admin falhar depois do mount inicial
        return;
    }

    setIsLoading(true);
    setError(null);
    setUpdateStatus({}); // Limpa status de atualização ao buscar
    try {
      // Usa o status do filtro na URL da API
      const response = await fetch(`/api/admin/redemptions?status=${statusFilter}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Erro ${response.status}`);
      }
      const data = await response.json();
      // Valida se a resposta é um array antes de definir o estado
      if (Array.isArray(data)) {
          setRedemptions(data);
      } else {
          console.error("API response is not an array:", data);
          throw new Error("Resposta inesperada da API ao buscar resgates.");
      }
    } catch (err: any) {
      setError(err.message || "Falha ao buscar resgates.");
      setRedemptions([]); // Limpa em caso de erro
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]); // Depende de isAdmin para reavaliar se necessário

  // Busca inicial e ao mudar o filtro
  useEffect(() => {
    // A verificação de isAdmin agora está dentro de fetchRedemptions
    fetchRedemptions(filterStatus);
  }, [filterStatus, fetchRedemptions]); // fetchRedemptions já inclui isAdmin como dependência

  // Função para atualizar o status de um resgate
  const handleUpdateStatus = async (redeemId: string, newStatus: 'paid' | 'canceled') => {
    setUpdateStatus(prev => ({ ...prev, [redeemId]: 'loading' }));
    setError(null); // Limpa erro global

    try {
      // Nota: A API chamada aqui é /api/affiliate/redeem, não /api/admin/redemptions/update
      // Verifique se esta é a API correta para atualizar o status
      const response = await fetch('/api/affiliate/redeem', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redeemId, newStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erro ao atualizar status para ${newStatus}`);
      }

      setUpdateStatus(prev => ({ ...prev, [redeemId]: 'success' }));
      // Atualiza a lista buscando novamente para garantir consistência
      fetchRedemptions(filterStatus);

    } catch (err: any) {
      console.error(`Erro ao marcar como ${newStatus}:`, err);
      setError(`Erro ao marcar ${redeemId} como ${newStatus}: ${err.message}`);
      setUpdateStatus(prev => ({ ...prev, [redeemId]: 'error' }));
      // Remove o estado de erro do botão após um tempo
      setTimeout(() => setUpdateStatus(prev => ({ ...prev, [redeemId]: 'idle' })), 3000);
    } finally {
        // Remove o estado de sucesso ou loading (caso erro ocorra antes do success) do botão após um tempo
         setTimeout(() => setUpdateStatus(prev => ({ ...prev, [redeemId]: 'idle' })), 2000);
    }
  };


  // Renderiza estado de loading ou se não for admin
  if (status === 'loading' || (isLoading && !redemptions.length)) { // Mostra loading se status é loading ou se está carregando e ainda não tem dados
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <FaSpinner className="animate-spin w-8 h-8 text-brand-pink" />
      </div>
    );
  }

  // Se não for admin após carregar a sessão
  if (!isAdmin && status === 'authenticated') {
     return (
        <div className="text-center py-10">
            <p className="text-red-600 font-semibold">Acesso Negado.</p>
            <p className="text-gray-500 text-sm">Você não tem permissão para acessar esta página.</p>
        </div>
     );
  }


  // Renderização principal da página
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Gerenciar Resgates de Afiliados</h1>

      {/* Filtros de Status */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(['pending', 'paid', 'canceled', 'all'] as const).map((statusOption) => (
          <button
            key={statusOption}
            onClick={() => setFilterStatus(statusOption)}
            className={`px-4 py-1.5 text-sm rounded-full border transition-colors duration-150 ease-in-out ${
              filterStatus === statusOption
                ? 'bg-pink-600 text-white border-pink-600 font-semibold shadow-sm' // Estilo ativo
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:border-gray-400' // Estilo inativo
            }`}
          >
            {statusOption === 'pending' ? 'Pendentes' :
             statusOption === 'paid' ? 'Pagos' :
             statusOption === 'canceled' ? 'Cancelados' : 'Todos'}
          </button>
        ))}
      </div>

      {/* Exibe erro global */}
      <AnimatePresence>
        {error && <FeedbackMessage message={error} type="error" />}
      </AnimatePresence>

      {/* Tabela de Resgates */}
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm"> {/* min-w para forçar scroll se necessário */}
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Data Solicitação</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Afiliado</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Valor (R$)</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Dados Pagamento</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Status</th>
              {filterStatus === 'pending' && (
                <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Ações</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Estado de Loading dentro da tabela */}
            {isLoading && (
                 <tr>
                    <td colSpan={filterStatus === 'pending' ? 6 : 5} className="text-center py-10 text-gray-500">
                        <div className="flex justify-center items-center gap-2">
                            <FaSpinner className="animate-spin w-4 h-4" />
                            <span>Carregando resgates...</span>
                        </div>
                    </td>
                 </tr>
            )}
            {/* Estado de Nenhum Resultado */}
            {!isLoading && redemptions.length === 0 && (
              <tr>
                <td colSpan={filterStatus === 'pending' ? 6 : 5} className="text-center py-10 text-gray-500">
                  Nenhum resgate encontrado para o status "{filterStatus}".
                </td>
              </tr>
            )}
            {/* Linhas da Tabela */}
            {!isLoading && redemptions.map((r) => (
              <tr key={r._id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {/* Formata a data de forma mais legível */}
                  {new Date(r.createdAt).toLocaleString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <div className="flex items-center gap-2">
                     {/* Placeholder para imagem/avatar */}
                     {/* <FaUserCircle className="w-5 h-5 text-gray-400"/> */}
                     <div>
                        <div className="font-medium text-gray-800">{r.user?.name || 'Nome não disponível'}</div>
                        <div className="text-xs text-gray-500">{r.user?.email || 'Email não disponível'}</div>
                     </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-800 font-medium">
                  {/* Formata como moeda brasileira */}
                  {r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-xs"> {/* Limita largura da coluna */}
                  <PaymentDetails paymentInfo={r.user?.paymentInfo} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={r.status} />
                </td>
                {/* Coluna de Ações visível apenas para pendentes */}
                {filterStatus === 'pending' && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateStatus(r._id, 'paid')}
                        disabled={updateStatus[r._id] === 'loading'}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait flex items-center gap-1 transition duration-150 ease-in-out"
                        title="Marcar como Pago"
                      >
                        {updateStatus[r._id] === 'loading' ? <FaSpinner className="animate-spin w-3 h-3"/> : <FaCheckCircle className="w-3 h-3"/>}
                        Pago
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(r._id, 'canceled')}
                        disabled={updateStatus[r._id] === 'loading'}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-wait flex items-center gap-1 transition duration-150 ease-in-out"
                        title="Cancelar Resgate"
                      >
                         {updateStatus[r._id] === 'loading' ? <FaSpinner className="animate-spin w-3 h-3"/> : <FaTimesCircle className="w-3 h-3"/>}
                        Cancelar
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

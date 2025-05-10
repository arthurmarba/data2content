// src/app/admin/redemptions/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaUserCircle, FaCopy, FaFileCsv, FaPencilAlt } from "react-icons/fa"; // FaFileCsv, FaPencilAlt adicionados
import { motion, AnimatePresence } from "framer-motion";

export const dynamic = 'force-dynamic';

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
  user: UserInfo;
  amount: number;
  status: "pending" | "paid" | "canceled";
  createdAt: string;
  updatedAt: string;
  notes?: string; // Campo notes já estava aqui, ótimo!
}

type UpdateStatusState = {
    [key: string]: 'idle' | 'loading' | 'success' | 'error';
};

// --- Componentes Auxiliares (StatusBadge, FeedbackMessage, PaymentDetails mantidos como antes) ---
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

const FeedbackMessage = ({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) => {
  const iconMap = { success: <FaCheckCircle className="text-green-500" />, error: <FaTimesCircle className="text-red-500" />, info: <FaExclamationTriangle className="text-yellow-500" /> };
  const colorMap = { success: 'text-green-600 bg-green-50 border-green-200', error: 'text-red-600 bg-red-50 border-red-200', info: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
  return ( <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`flex items-center gap-2 text-sm font-medium p-3 rounded border ${colorMap[type]} my-4`} > {iconMap[type]} <span>{message}</span> </motion.div> );
};

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
            {paymentInfo.pixKey && ( <div className="flex items-center gap-1"> <strong className="text-gray-600">Pix:</strong> <span className="font-mono bg-gray-100 px-1 rounded text-gray-700 break-all">{paymentInfo.pixKey}</span> <button onClick={() => copyToClipboard(paymentInfo.pixKey, 'pix')} title="Copiar Chave Pix" className="ml-1 text-gray-400 hover:text-brand-pink"> {copiedKey === 'pix' ? <FaCheckCircle className="w-3 h-3 text-green-500"/> : <FaCopy className="w-3 h-3"/>} </button> </div> )}
            {paymentInfo.bankName && ( <div className="flex items-center gap-1"> <strong className="text-gray-600">Banco:</strong> <span className="text-gray-700">{paymentInfo.bankName}</span> </div> )}
            {paymentInfo.bankAgency && ( <div className="flex items-center gap-1"> <strong className="text-gray-600">Ag:</strong> <span className="font-mono text-gray-700">{paymentInfo.bankAgency}</span> <button onClick={() => copyToClipboard(paymentInfo.bankAgency, 'ag')} title="Copiar Agência" className="ml-1 text-gray-400 hover:text-brand-pink"> {copiedKey === 'ag' ? <FaCheckCircle className="w-3 h-3 text-green-500"/> : <FaCopy className="w-3 h-3"/>} </button> </div> )}
            {paymentInfo.bankAccount && ( <div className="flex items-center gap-1"> <strong className="text-gray-600">CC:</strong> <span className="font-mono text-gray-700">{paymentInfo.bankAccount}</span> <button onClick={() => copyToClipboard(paymentInfo.bankAccount, 'cc')} title="Copiar Conta" className="ml-1 text-gray-400 hover:text-brand-pink"> {copiedKey === 'cc' ? <FaCheckCircle className="w-3 h-3 text-green-500"/> : <FaCopy className="w-3 h-3"/>} </button> </div> )}
        </div>
    );
};

// --- NOVO: Componente Modal para Confirmação de Ação e Edição de Notas ---
interface ActionConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  redemption: RedemptionAdmin | null;
  currentNotes: string;
  onNotesChange: (notes: string) => void;
  onConfirm: (newStatus: 'paid' | 'canceled') => void;
  actionToConfirm: 'paid' | 'canceled' | null;
  isLoadingAction: boolean;
}

const ActionConfirmationModal: React.FC<ActionConfirmationModalProps> = ({
  isOpen,
  onClose,
  redemption,
  currentNotes,
  onNotesChange,
  onConfirm,
  actionToConfirm,
  isLoadingAction
}) => {
  if (!isOpen || !redemption || !actionToConfirm) return null;

  const actionText = actionToConfirm === 'paid' ? 'Marcar como Pago' : 'Cancelar Resgate';
  const confirmButtonColor = actionToConfirm === 'paid' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md"
      >
        <h3 className="text-lg font-semibold mb-2 text-gray-800">{actionText}</h3>
        <p className="text-sm text-gray-600 mb-1">Afiliado: <span className="font-medium">{redemption.user.name || redemption.user.email}</span></p>
        <p className="text-sm text-gray-600 mb-4">Valor: <span className="font-medium">{redemption.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
        
        <div className="mb-4">
          <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700 mb-1">
            Notas Administrativas (Opcional):
          </label>
          <textarea
            id="adminNotes"
            rows={3}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-brand-pink focus:border-brand-pink"
            value={currentNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Ex: Pago via PIX em DD/MM/AAAA, ID Transação XYZ..."
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            disabled={isLoadingAction}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(actionToConfirm)}
            className={`px-4 py-2 text-sm font-medium text-white ${confirmButtonColor} rounded-md transition-colors disabled:opacity-50`}
            disabled={isLoadingAction}
          >
            {isLoadingAction ? <FaSpinner className="animate-spin inline mr-2" /> : null}
            Confirmar {actionText.split(' ')[0]} {/* "Confirmar Pago" ou "Confirmar Cancelar" */}
          </button>
        </div>
      </motion.div>
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
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusState>({});

  // --- NOVO: Estados para o modal de notas ---
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedRedemptionForNotes, setSelectedRedemptionForNotes] = useState<RedemptionAdmin | null>(null);
  const [currentNotes, setCurrentNotes] = useState("");
  const [actionToConfirm, setActionToConfirm] = useState<'paid' | 'canceled' | null>(null);


  const isAdmin = useMemo(() => session?.user?.role === 'admin', [session]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || !isAdmin) {
      router.replace('/');
    }
  }, [status, isAdmin, router]);

  const fetchRedemptions = useCallback(async (currentFilterStatus: string) => {
    if (!isAdmin) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    setUpdateStatus({});
    try {
      const response = await fetch(`/api/admin/redemptions?status=${currentFilterStatus}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Erro ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
          setRedemptions(data);
      } else {
          console.error("API response is not an array:", data);
          throw new Error("Resposta inesperada da API ao buscar resgates.");
      }
    } catch (err: any) {
      setError(err.message || "Falha ao buscar resgates.");
      setRedemptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if(isAdmin) { // Garante que fetchRedemptions só seja chamado se isAdmin for true
        fetchRedemptions(filterStatus);
    }
  }, [filterStatus, isAdmin, fetchRedemptions]);


  // --- NOVO: Função para abrir o modal de confirmação e notas ---
  const openNotesModal = (redemption: RedemptionAdmin, action: 'paid' | 'canceled') => {
    setSelectedRedemptionForNotes(redemption);
    setCurrentNotes(redemption.notes || ""); // Carrega notas existentes
    setActionToConfirm(action);
    setIsNotesModalOpen(true);
  };

  // --- ATUALIZADO: Função para atualizar o status de um resgate (agora chamada pelo modal) ---
  const handleUpdateStatusAndNotes = async () => {
    if (!selectedRedemptionForNotes || !actionToConfirm) return;

    const redeemId = selectedRedemptionForNotes._id;
    const newStatus = actionToConfirm;

    setUpdateStatus(prev => ({ ...prev, [redeemId]: 'loading' }));
    setError(null);

    try {
      const response = await fetch('/api/affiliate/redeem', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Envia newStatus e as adminNotes (usando o estado currentNotes)
        body: JSON.stringify({ redeemId, newStatus, adminNotes: currentNotes }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Erro ao atualizar status para ${newStatus}`);
      }
      setUpdateStatus(prev => ({ ...prev, [redeemId]: 'success' }));
      fetchRedemptions(filterStatus); // Rebusca para atualizar a lista
      setIsNotesModalOpen(false); // Fecha o modal
      setSelectedRedemptionForNotes(null);
      setCurrentNotes("");
    } catch (err: any) {
      console.error(`Erro ao marcar como ${newStatus}:`, err);
      setError(`Erro ao marcar ${redeemId} como ${newStatus}: ${err.message}`); // Mostra erro no modal ou global?
      setUpdateStatus(prev => ({ ...prev, [redeemId]: 'error' }));
      // Não fecha modal em caso de erro para usuário tentar novamente ou corrigir
      setTimeout(() => setUpdateStatus(prev => ({ ...prev, [redeemId]: 'idle' })), 3000);
    }
    // Removido finally para não fechar modal em caso de erro abruptamente
    // setTimeout para limpar estado do botão do modal em si pode ser gerenciado dentro do modal ou aqui
  };
  
  // --- NOVO: Função para Exportar CSV ---
  const handleExportCSV = () => {
    if (!isAdmin) return;
    const exportUrl = `/api/admin/redemptions?status=${filterStatus}&export=csv`;
    // Abre a URL em uma nova aba/janela, o navegador tratará o download
    window.open(exportUrl, '_blank');
  };


  if (status === 'loading' || (isLoading && !redemptions.length && isAdmin)) {
    return ( <div className="flex justify-center items-center min-h-[calc(100vh-200px)]"> <FaSpinner className="animate-spin w-8 h-8 text-brand-pink" /> </div> );
  }
  if (!isAdmin && status === 'authenticated') {
     return ( <div className="text-center py-10"> <p className="text-red-600 font-semibold">Acesso Negado.</p> <p className="text-gray-500 text-sm">Você não tem permissão para acessar esta página.</p> </div> );
  }

  return (
    <> {/* Fragmento para o modal */}
      <ActionConfirmationModal
        isOpen={isNotesModalOpen}
        onClose={() => {
            setIsNotesModalOpen(false);
            setSelectedRedemptionForNotes(null);
            // Limpa o estado do botão se o modal for fechado sem confirmar
            if(selectedRedemptionForNotes?._id && updateStatus[selectedRedemptionForNotes._id] === 'loading') {
                 setUpdateStatus(prev => ({ ...prev, [selectedRedemptionForNotes._id]: 'idle' }));
            }
        }}
        redemption={selectedRedemptionForNotes}
        currentNotes={currentNotes}
        onNotesChange={setCurrentNotes}
        onConfirm={handleUpdateStatusAndNotes} // Chama a função atualizada
        actionToConfirm={actionToConfirm}
        isLoadingAction={selectedRedemptionForNotes ? updateStatus[selectedRedemptionForNotes._id] === 'loading' : false}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-2xl font-bold text-gray-800">Gerenciar Resgates de Afiliados</h1>
            {/* Botão de Exportar CSV */}
            <button
                onClick={handleExportCSV}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                title="Exportar lista atual para CSV"
            >
                <FaFileCsv className="w-4 h-4"/>
                Exportar CSV
            </button>
        </div>


        {/* Filtros de Status */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(['pending', 'paid', 'canceled', 'all'] as const).map((statusOption) => (
            <button
              key={statusOption}
              onClick={() => setFilterStatus(statusOption)}
              className={`px-4 py-1.5 text-sm rounded-full border transition-colors duration-150 ease-in-out ${
                filterStatus === statusOption
                  ? 'bg-pink-600 text-white border-pink-600 font-semibold shadow-sm'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              {statusOption === 'pending' ? 'Pendentes' :
               statusOption === 'paid' ? 'Pagos' :
               statusOption === 'canceled' ? 'Cancelados' : 'Todos'}
            </button>
          ))}
        </div>

        <AnimatePresence> {error && <FeedbackMessage message={error} type="error" />} </AnimatePresence>

        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm"> {/* Aumentado min-w para nova coluna */}
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Data Solicitação</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Afiliado</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Valor (R$)</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Dados Pagamento</th>
                {/* NOVA COLUNA NOTAS ADMIN */}
                <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Notas Admin</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Status</th>
                {/* Ações apenas para pendentes ou todas as não pagas */}
                {(filterStatus === 'pending' || filterStatus === 'all') && (
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 tracking-wider uppercase text-xs">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && ( <tr> <td colSpan={(filterStatus === 'pending' || filterStatus === 'all') ? 7 : 6} className="text-center py-10 text-gray-500"> <div className="flex justify-center items-center gap-2"> <FaSpinner className="animate-spin w-4 h-4" /> <span>Carregando resgates...</span> </div> </td> </tr> )}
              {!isLoading && redemptions.length === 0 && ( <tr> <td colSpan={(filterStatus === 'pending' || filterStatus === 'all') ? 7 : 6} className="text-center py-10 text-gray-500"> Nenhum resgate encontrado para o status "{filterStatus}". </td> </tr> )}
              {!isLoading && redemptions.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap"> {new Date(r.createdAt).toLocaleString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} </td>
                  <td className="px-4 py-3 text-gray-700"> <div className="flex items-center gap-2"> <div> <div className="font-medium text-gray-800">{r.user?.name || 'Nome não disponível'}</div> <div className="text-xs text-gray-500">{r.user?.email || 'Email não disponível'}</div> </div> </div> </td>
                  <td className="px-4 py-3 text-gray-800 font-medium"> {r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} </td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs"> <PaymentDetails paymentInfo={r.user?.paymentInfo} /> </td>
                  {/* EXIBIÇÃO DAS NOTAS */}
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-[200px] whitespace-pre-wrap break-words"> {/* Permite quebra de linha e limita largura */}
                    {r.notes || <span className="italic text-gray-400">N/A</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"> <StatusBadge status={r.status} /> </td>
                  {(filterStatus === 'pending' || (filterStatus === 'all' && r.status === 'pending')) && ( // Mostra ações para pendentes no filtro 'all' também
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openNotesModal(r, 'paid')} // Abre o modal
                          disabled={updateStatus[r._id] === 'loading'}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait flex items-center gap-1 transition duration-150 ease-in-out"
                          title="Marcar como Pago"
                        >
                          {updateStatus[r._id] === 'loading' && actionToConfirm === 'paid' && selectedRedemptionForNotes?._id === r._id ? <FaSpinner className="animate-spin w-3 h-3"/> : <FaCheckCircle className="w-3 h-3"/>}
                          Pago
                        </button>
                        <button
                          onClick={() => openNotesModal(r, 'canceled')} // Abre o modal
                          disabled={updateStatus[r._id] === 'loading'}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-wait flex items-center gap-1 transition duration-150 ease-in-out"
                          title="Cancelar Resgate"
                        >
                           {updateStatus[r._id] === 'loading' && actionToConfirm === 'canceled' && selectedRedemptionForNotes?._id === r._id ? <FaSpinner className="animate-spin w-3 h-3"/> : <FaTimesCircle className="w-3 h-3"/>}
                          Cancelar
                        </button>
                      </div>
                    </td>
                  )}
                   {/* Se não for filtro 'pending' e não for 'all' com status 'pending', exibir célula vazia para alinhar colunas */}
                  {(filterStatus !== 'pending' && !(filterStatus === 'all' && r.status === 'pending')) && (
                    <td className="px-4 py-3"></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
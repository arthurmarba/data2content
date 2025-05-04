// src/app/dashboard/InstagramConnectCard.tsx
// Atualizado para incluir seleção de conta Instagram
// CORRIGIDO: Usa 'type' com interseção em vez de 'interface extends'
// CORRIGIDO: Acesso mais seguro a availableIgAccounts[0]
// REVISADO: Simplifica useEffect para definir conta padrão baseado na sessão atual
// MELHORADO: Tratamento e exibição de mensagens de erro

"use client";

import React, { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { FaFacebook, FaInstagram, FaSpinner, FaUnlink, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import { motion } from "framer-motion";
import type { AvailableInstagramAccount } from '@/app/lib/instagramService';
import type { Session } from "next-auth";
import { useSearchParams } from 'next/navigation';

interface InstagramConnectCardProps {}

type BaseUserType = NonNullable<Session['user']>;
type SessionUserWithInstagram = BaseUserType & {
    instagramConnected?: boolean;
    pendingInstagramConnection?: boolean;
    availableIgAccounts?: AvailableInstagramAccount[] | null;
    igConnectionError?: string; // Erro vindo do backend (busca de contas)
    instagramAccountId?: string;
    instagramUsername?: string;
    provider?: string;
    role?: string;
    planStatus?: string;
    planExpiresAt?: string | null;
    affiliateCode?: string;
    affiliateBalance?: number;
    affiliateRank?: number;
    affiliateInvites?: number;
};


const InstagramConnectCard: React.FC<InstagramConnectCardProps> = () => {
    // --- Hooks de Estado e Sessão ---
    const { data: session, status, update } = useSession();
    const searchParams = useSearchParams();
    const [isLinking, setIsLinking] = useState(false);
    const [linkError, setLinkError] = useState<string | null>(null); // Erro ao iniciar link
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [disconnectError, setDisconnectError] = useState<string | null>(null); // Erro ao desconectar
    const [selectedIgAccountId, setSelectedIgAccountId] = useState<string>('');
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [finalizeError, setFinalizeError] = useState<string | null>(null); // Erro ao finalizar

    // --- Efeito para definir conta padrão ---
    useEffect(() => {
        // console.log("[InstagramConnectCard] useEffect - Status:", status);
        if (status === 'authenticated') {
            const user = session?.user as SessionUserWithInstagram | undefined;
            // console.log("[InstagramConnectCard] useEffect - Session User:", JSON.stringify(user, null, 2));

            if (user?.instagramConnected || !user?.pendingInstagramConnection) {
                 if (selectedIgAccountId !== '') {
                    // console.log("[InstagramConnectCard] Limpando seleção de conta IG.");
                    setSelectedIgAccountId('');
                 }
            } else if (user?.pendingInstagramConnection && user.availableIgAccounts && user.availableIgAccounts.length > 0 && !selectedIgAccountId) {
                const accounts = user.availableIgAccounts;
                const firstAccount = accounts[0];
                if (firstAccount) {
                    setSelectedIgAccountId(firstAccount.igAccountId);
                    // console.log("[InstagramConnectCard] Definindo conta IG padrão:", firstAccount.igAccountId);
                }
            }
        }
    }, [status, session, selectedIgAccountId]);

    // --- Variáveis Derivadas da Sessão ---
    const isLoadingSession = status === 'loading';
    const isAuthenticated = status === 'authenticated';
    const user = session?.user as SessionUserWithInstagram | undefined;
    const isInstagramConnected = user?.instagramConnected ?? false;
    const cameFromRedirect = searchParams.get('step') === 'selectAccount';
    const isPendingConnection = !isInstagramConnected && (cameFromRedirect || (user?.pendingInstagramConnection ?? false));
    const availableAccounts = (isPendingConnection && user?.availableIgAccounts) ? user.availableIgAccounts : [];

    // --- Lógica de Exibição de Erro Melhorada ---
    const getDisplayError = (): string | null => {
        // Prioriza erros de ações recentes do usuário
        if (finalizeError) return `Erro ao confirmar: ${finalizeError}`;
        if (disconnectError) return `Erro ao desconectar: ${disconnectError}`;
        // Depois, erros vindos do backend na sessão
        if (user?.igConnectionError) {
            // Mapeia erros comuns do backend para mensagens mais amigáveis
            if (user.igConnectionError.includes("Nenhuma conta Instagram Business/Creator encontrada")) {
                return "Nenhuma conta Instagram profissional foi encontrada vinculada às suas Páginas do Facebook.";
            }
            if (user.igConnectionError.includes("Permissão `pages_show_list` ausente")) {
                return "Permissão para listar suas Páginas do Facebook não foi concedida. Tente conectar novamente.";
            }
            if (user.igConnectionError.includes("Token de acesso inválido")) {
                 return "Sua conexão com o Facebook expirou ou é inválida. Tente conectar novamente.";
            }
            // Erro genérico vindo do backend
            return `Erro na conexão: ${user.igConnectionError}`;
        }
        // Por último, erro ao iniciar o link
        if (linkError) return `Erro ao iniciar: ${linkError}`;
        return null; // Nenhum erro a exibir
    };
    const displayError = getDisplayError();

    // console.log(`[InstagramConnectCard] Render Check: isLoadingSession=${isLoadingSession}, isAuthenticated=${isAuthenticated}, isInstagramConnected=${isInstagramConnected}, isPendingConnection=${isPendingConnection}, cameFromRedirect=${cameFromRedirect}, displayError=${displayError}`);

    // --- Funções Handler ---
    const handleInitiateFacebookLink = async () => {
        setIsLinking(true);
        setLinkError(null); setDisconnectError(null); setFinalizeError(null);
        // console.log("[InstagramConnectCard] Iniciando processo de vinculação (passo 1)...");
        try {
            // console.log("[InstagramConnectCard] Chamando POST /api/auth/iniciar-vinculacao-fb...");
            const response = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            // console.log("[InstagramConnectCard] Resposta API iniciar-vinculacao:", response.status);
            if (!response.ok) {
                let errorMessage = 'Falha ao preparar a vinculação.';
                try { const errorData = await response.json(); errorMessage = errorData.message || errorMessage; } catch (e) {}
                throw new Error(errorMessage);
            }
            // console.log("[InstagramConnectCard] API iniciar-vinculacao OK. Redirecionando para signIn('facebook')...");
            signIn('facebook', { callbackUrl: '/dashboard?step=selectAccount' });
        } catch (error: any) {
            console.error("[InstagramConnectCard] Erro ao iniciar vinculação:", error);
            setLinkError(error.message || 'Ocorreu um erro inesperado.');
            setIsLinking(false);
        }
    };

    const handleFinalizeConnection = async () => {
        if (!selectedIgAccountId) { setFinalizeError("Por favor, selecione uma conta Instagram."); return; }
        setIsFinalizing(true);
        setFinalizeError(null); setLinkError(null); setDisconnectError(null);
        // console.log(`[InstagramConnectCard] Finalizando conexão com conta selecionada: ${selectedIgAccountId}`);
        try {
            // console.log("[InstagramConnectCard] Chamando POST /api/instagram/finalize-connection...");
            const response = await fetch('/api/instagram/finalize-connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedIgAccountId }) });
            // console.log("[InstagramConnectCard] Resposta API finalize-connection:", response.status);
            if (!response.ok) {
                let errorMessage = 'Falha ao finalizar a conexão.';
                try { const errorData = await response.json(); errorMessage = errorData.message || errorMessage; } catch (e) {}
                throw new Error(errorMessage);
            }
            // console.log("[InstagramConnectCard] API finalize-connection OK. Atualizando sessão...");
            window.history.replaceState(null, '', '/dashboard'); // Limpa query param
            await update(); // Atualiza a sessão
            // console.log("[InstagramConnectCard] Sessão atualizada após finalização.");
            setSelectedIgAccountId('');
        } catch (error: any) {
            console.error("[InstagramConnectCard] Erro ao finalizar conexão:", error);
            setFinalizeError(error.message || 'Ocorreu um erro inesperado ao finalizar.');
        } finally {
            setIsFinalizing(false);
        }
    };

    const handleDisconnectInstagram = async () => {
        setIsDisconnecting(true);
        setDisconnectError(null); setLinkError(null); setFinalizeError(null);
        // console.log("[InstagramConnectCard] Iniciando processo de desconexão...");
        try {
            // console.log("[InstagramConnectCard] Chamando POST /api/instagram/disconnect...");
            const response = await fetch('/api/instagram/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            // console.log("[InstagramConnectCard] Resposta API desconexão:", response.status);
            if (!response.ok) {
                let errorMessage = 'Falha ao desconectar.';
                try { const errorData = await response.json(); errorMessage = errorData.message || errorData.error || errorMessage; } catch (e) {}
                throw new Error(errorMessage);
            }
            // console.log("[InstagramConnectCard] API desconexão OK. Atualizando sessão...");
            await update();
            // console.log("[InstagramConnectCard] Sessão atualizada após desconexão.");
        } catch (error: any) {
            console.error("[InstagramConnectCard] Erro ao desconectar Instagram:", error);
            setDisconnectError(error.message || 'Ocorreu um erro inesperado ao desconectar.');
        } finally {
            setIsDisconnecting(false);
        }
    };

    // --- Renderização ---
    const cardVariants = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };

    if (isLoadingSession || !isAuthenticated) {
        // console.log("[InstagramConnectCard] Não renderizando (sessão carregando ou não autenticada).");
        return null;
    }

    // console.log("[InstagramConnectCard] Renderizando card.");
    return (
        <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={1.5}>
            <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Automação de Métricas</h2>
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Informações da Integração */}
                    <div className="flex items-center gap-3">
                        <FaInstagram className="w-8 h-8 text-pink-600 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-lg text-gray-800">Instagram Insights</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {isInstagramConnected
                                    ? `Conectado como: ${user?.instagramUsername ?? user?.instagramAccountId ?? 'Conta Conectada'}`
                                    : "Conecte sua conta profissional do Instagram para coletar métricas automaticamente."
                                }
                            </p>
                        </div>
                    </div>

                    {/* Botão e Status */}
                    <div className="flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                        {isInstagramConnected ? (
                            // --- Estado Conectado ---
                           <div className="flex flex-col sm:items-end items-center gap-2">
                                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full border border-green-200 whitespace-nowrap">
                                    <FaCheckCircle /> Conectado
                                </span>
                                <button onClick={handleDisconnectInstagram} disabled={isDisconnecting} title="Desconectar conta Instagram" className="px-3 py-1 bg-red-100 text-red-600 text-xs font-medium rounded hover:bg-red-200 border border-red-200 flex items-center justify-center gap-1 disabled:opacity-70 disabled:cursor-wait">
                                    {isDisconnecting ? <FaSpinner className="animate-spin w-3 h-3" /> : <FaUnlink className="w-3 h-3" />}
                                    {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                                </button>
                                {/* Mostra erro de desconexão, se houver */}
                                {disconnectError && ( <p className="text-xs text-red-600 mt-1 flex items-center gap-1 text-right"> <FaExclamationCircle /> {disconnectError} </p> )}
                            </div>
                        ) : isPendingConnection ? (
                            // --- Estado Pendente de Seleção ---
                            <div className="flex flex-col items-center sm:items-end w-full sm:w-auto gap-2">
                                <label htmlFor="igAccountSelect" className="text-sm font-medium text-gray-700 self-start sm:self-end">Selecione a conta Instagram:</label>
                                <select id="igAccountSelect" value={selectedIgAccountId} onChange={(e) => { setSelectedIgAccountId(e.target.value); setFinalizeError(null); }} disabled={isFinalizing || availableAccounts.length === 0} className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:opacity-70 bg-white">
                                    {availableAccounts.length === 0 && !user?.igConnectionError && <option value="">Carregando contas...</option>}
                                    {/* Mostra erro se a busca falhou */}
                                    {availableAccounts.length === 0 && user?.igConnectionError && <option value="">Erro ao buscar contas</option>}
                                    {availableAccounts.map(acc => ( <option key={acc.igAccountId} value={acc.igAccountId}> {acc.pageName} ({acc.igAccountId}) </option> ))}
                                </select>
                                <button onClick={handleFinalizeConnection} disabled={isFinalizing || availableAccounts.length === 0 || !selectedIgAccountId} className="w-full sm:w-auto px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center justify-center gap-2 transition duration-150 ease-in-out disabled:opacity-70 disabled:cursor-wait">
                                    {isFinalizing ? <FaSpinner className="animate-spin w-4 h-4" /> : <FaCheckCircle className="w-4 h-4" />}
                                    {isFinalizing ? 'Confirmando...' : 'Confirmar Conta'}
                                </button>
                                {/* Mostra o erro mais relevante (v1.8.5) */}
                                {displayError && ( <p className="text-xs text-red-600 mt-1 flex items-center gap-1 self-start sm:self-end text-left sm:text-right max-w-xs"> <FaExclamationCircle className="flex-shrink-0 w-3 h-3"/> {displayError} </p> )}
                            </div>
                        ) : (
                            // --- Estado Desconectado (Inicial) ---
                            <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                                <button onClick={handleInitiateFacebookLink} disabled={isLinking} className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2 transition duration-150 ease-in-out disabled:opacity-70 disabled:cursor-wait">
                                    {isLinking ? <FaSpinner className="animate-spin w-4 h-4" /> : <FaFacebook className="w-4 h-4" />}
                                    {isLinking ? 'Iniciando...' : 'Conectar com Facebook'}
                                </button>
                                {/* Mostra o erro mais relevante (v1.8.5) */}
                                {displayError && ( <p className="text-xs text-red-600 mt-2 flex items-center gap-1 self-start sm:self-end text-left sm:text-right max-w-xs"> <FaExclamationCircle className="flex-shrink-0 w-3 h-3"/> {displayError} </p> )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Mensagem adicional */}
                <p className="text-xs text-gray-500 mt-4 border-t border-gray-100 pt-3">
                    {isInstagramConnected
                        ? "A coleta automática de métricas está ativa. Novos dados serão buscados periodicamente."
                        : isPendingConnection
                            ? "Selecione a conta Instagram correta na lista acima e clique em \"Confirmar Conta\" para finalizar a conexão."
                            : "Clique em \"Conectar com Facebook\" para autorizar o acesso à sua conta do Instagram vinculada e automatizar a coleta."
                    }
                </p>
            </div>
        </motion.section>
    );
};

export default InstagramConnectCard;

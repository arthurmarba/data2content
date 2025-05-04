// src/app/dashboard/InstagramConnectCard.tsx
// Atualizado para incluir seleção de conta Instagram
// CORRIGIDO: Usa 'type' com interseção em vez de 'interface extends'
// CORRIGIDO: Acesso mais seguro a availableIgAccounts[0]
// REVISADO: Usa query param 'action=selectIgAccount' para mostrar seleção
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
    pendingInstagramConnection?: boolean; // Ainda lemos da sessão para pegar a lista
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

            // Define a conta padrão APENAS se tivermos contas na sessão E nenhuma estiver selecionada ainda
            if (user?.availableIgAccounts && user.availableIgAccounts.length > 0 && !selectedIgAccountId) {
                const accounts = user.availableIgAccounts;
                const firstAccount = accounts[0];
                if (firstAccount) {
                    setSelectedIgAccountId(firstAccount.igAccountId);
                    // console.log("[InstagramConnectCard] Definindo conta IG padrão:", firstAccount.igAccountId);
                }
            }
            // Limpa seleção se usuário conectar ou deslogar
            else if (user?.instagramConnected && selectedIgAccountId !== '') {
                 // console.log("[InstagramConnectCard] Limpando seleção (conectado).");
                 setSelectedIgAccountId('');
            }
        } else if (status === 'unauthenticated' && selectedIgAccountId !== '') {
             // console.log("[InstagramConnectCard] Limpando seleção (deslogado).");
             setSelectedIgAccountId('');
        }
    }, [status, session, selectedIgAccountId]); // Depende da sessão para obter a lista

    // --- Variáveis Derivadas ---
    const isLoadingSession = status === 'loading';
    const isAuthenticated = status === 'authenticated';
    const user = session?.user as SessionUserWithInstagram | undefined;
    const isInstagramConnected = user?.instagramConnected ?? false;

    // --- Lógica de Estado Pendente REVISADA ---
    // O estado pendente é determinado PRIMARIAMENTE pelo query param
    const showSelectionUI = searchParams.get('action') === 'selectIgAccount';
    // A lista de contas ainda vem da sessão (pode demorar um pouco para popular)
    const availableAccounts = (showSelectionUI && user?.availableIgAccounts) ? user.availableIgAccounts : [];
    // Erro a ser exibido
    const getDisplayError = (): string | null => {
        if (finalizeError) return `Erro ao confirmar: ${finalizeError}`;
        if (disconnectError) return `Erro ao desconectar: ${disconnectError}`;
        if (user?.igConnectionError) {
            if (user.igConnectionError.includes("Nenhuma conta Instagram Business/Creator encontrada")) return "Nenhuma conta Instagram profissional foi encontrada vinculada às suas Páginas do Facebook.";
            if (user.igConnectionError.includes("Permissão `pages_show_list` ausente")) return "Permissão para listar suas Páginas do Facebook não foi concedida. Tente conectar novamente.";
            if (user.igConnectionError.includes("Token de acesso inválido")) return "Sua conexão com o Facebook expirou ou é inválida. Tente conectar novamente.";
            return `Erro na conexão: ${user.igConnectionError}`;
        }
        if (linkError) return `Erro ao iniciar: ${linkError}`;
        return null;
    };
    const displayError = getDisplayError();

    // console.log(`[InstagramConnectCard] Render Check: isLoadingSession=${isLoadingSession}, isAuthenticated=${isAuthenticated}, isInstagramConnected=${isInstagramConnected}, showSelectionUI=${showSelectionUI}`);

    // --- Funções Handler ---
    const handleInitiateFacebookLink = async () => {
        setIsLinking(true);
        setLinkError(null); setDisconnectError(null); setFinalizeError(null);
        try {
            const response = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            if (!response.ok) {
                let errorMessage = 'Falha ao preparar a vinculação.';
                try { const errorData = await response.json(); errorMessage = errorData.message || errorMessage; } catch (e) {}
                throw new Error(errorMessage);
            }
            // Não precisa mais do ?step=selectAccount aqui, o redirect do backend cuidará disso
            signIn('facebook', { callbackUrl: '/dashboard' });
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
        try {
            const response = await fetch('/api/instagram/finalize-connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedIgAccountId }) });
            if (!response.ok) {
                let errorMessage = 'Falha ao finalizar a conexão.';
                try { const errorData = await response.json(); errorMessage = errorData.message || errorMessage; } catch (e) {}
                throw new Error(errorMessage);
            }
            // Limpa o query param da URL APÓS sucesso
            window.history.replaceState(null, '', '/dashboard');
            await update(); // Atualiza a sessão
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
        try {
            const response = await fetch('/api/instagram/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            if (!response.ok) {
                let errorMessage = 'Falha ao desconectar.';
                try { const errorData = await response.json(); errorMessage = errorData.message || errorData.error || errorMessage; } catch (e) {}
                throw new Error(errorMessage);
            }
            // Limpa query param se existir (caso desconecte antes de finalizar)
             window.history.replaceState(null, '', '/dashboard');
            await update();
        } catch (error: any) {
            console.error("[InstagramConnectCard] Erro ao desconectar Instagram:", error);
            setDisconnectError(error.message || 'Ocorreu um erro inesperado ao desconectar.');
        } finally {
            setIsDisconnecting(false);
        }
    };

    // --- Renderização ---
    const cardVariants = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };

    if (isLoadingSession || !isAuthenticated) { return null; }

    return (
        <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={1.5}>
            <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Automação de Métricas</h2>
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Informações */}
                    <div className="flex items-center gap-3">
                        <FaInstagram className="w-8 h-8 text-pink-600 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-lg text-gray-800">Instagram Insights</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {isInstagramConnected
                                    ? `Conectado como: ${user?.instagramUsername ?? user?.instagramAccountId ?? 'Conta Conectada'}`
                                    : "Conecte sua conta profissional do Instagram."
                                }
                            </p>
                        </div>
                    </div>

                    {/* Ações */}
                    <div className="flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                        {isInstagramConnected ? (
                            // --- Conectado ---
                           <div className="flex flex-col sm:items-end items-center gap-2">
                                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full border border-green-200 whitespace-nowrap">
                                    <FaCheckCircle /> Conectado
                                </span>
                                <button onClick={handleDisconnectInstagram} disabled={isDisconnecting} title="Desconectar conta Instagram" className="px-3 py-1 bg-red-100 text-red-600 text-xs font-medium rounded hover:bg-red-200 border border-red-200 flex items-center justify-center gap-1 disabled:opacity-70 disabled:cursor-wait">
                                    {isDisconnecting ? <FaSpinner className="animate-spin w-3 h-3" /> : <FaUnlink className="w-3 h-3" />}
                                    {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                                </button>
                                {disconnectError && ( <p className="text-xs text-red-600 mt-1 flex items-center gap-1 text-right"> <FaExclamationCircle /> {disconnectError} </p> )}
                            </div>
                        ) : showSelectionUI ? ( // <<< USA showSelectionUI (baseado no query param)
                            // --- Pendente de Seleção ---
                            <div className="flex flex-col items-center sm:items-end w-full sm:w-auto gap-2">
                                <label htmlFor="igAccountSelect" className="text-sm font-medium text-gray-700 self-start sm:self-end">Selecione a conta Instagram:</label>
                                <select id="igAccountSelect" value={selectedIgAccountId} onChange={(e) => { setSelectedIgAccountId(e.target.value); setFinalizeError(null); }} disabled={isFinalizing || availableAccounts.length === 0} className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:opacity-70 bg-white">
                                    {/* Mostra carregando se a lista da sessão ainda não chegou */}
                                    {availableAccounts.length === 0 && !user?.igConnectionError && <option value="">Carregando contas...</option>}
                                    {availableAccounts.length === 0 && user?.igConnectionError && <option value="">Erro ao buscar contas</option>}
                                    {availableAccounts.map(acc => ( <option key={acc.igAccountId} value={acc.igAccountId}> {acc.pageName} ({acc.igAccountId}) </option> ))}
                                </select>
                                <button onClick={handleFinalizeConnection} disabled={isFinalizing || availableAccounts.length === 0 || !selectedIgAccountId} className="w-full sm:w-auto px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center justify-center gap-2 transition duration-150 ease-in-out disabled:opacity-70 disabled:cursor-wait">
                                    {isFinalizing ? <FaSpinner className="animate-spin w-4 h-4" /> : <FaCheckCircle className="w-4 h-4" />}
                                    {isFinalizing ? 'Confirmando...' : 'Confirmar Conta'}
                                </button>
                                {displayError && ( <p className="text-xs text-red-600 mt-1 flex items-center gap-1 self-start sm:self-end text-left sm:text-right max-w-xs"> <FaExclamationCircle className="flex-shrink-0 w-3 h-3"/> {displayError} </p> )}
                            </div>
                        ) : (
                            // --- Desconectado (Inicial) ---
                            <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                                <button onClick={handleInitiateFacebookLink} disabled={isLinking} className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2 transition duration-150 ease-in-out disabled:opacity-70 disabled:cursor-wait">
                                    {isLinking ? <FaSpinner className="animate-spin w-4 h-4" /> : <FaFacebook className="w-4 h-4" />}
                                    {isLinking ? 'Iniciando...' : 'Conectar com Facebook'}
                                </button>
                                {displayError && ( <p className="text-xs text-red-600 mt-2 flex items-center gap-1 self-start sm:self-end text-left sm:text-right max-w-xs"> <FaExclamationCircle className="flex-shrink-0 w-3 h-3"/> {displayError} </p> )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Mensagem adicional */}
                <p className="text-xs text-gray-500 mt-4 border-t border-gray-100 pt-3">
                    {isInstagramConnected
                        ? "A coleta automática de métricas está ativa."
                        // Mensagem ajustada para quando showSelectionUI é true
                        : showSelectionUI
                            ? "Selecione a conta Instagram correta e clique em \"Confirmar Conta\"."
                            : "Clique em \"Conectar com Facebook\" para autorizar o acesso."
                    }
                </p>
            </div>
        </motion.section>
    );
};

export default InstagramConnectCard;

// src/app/dashboard/InstagramConnectCard.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { FaFacebook, FaInstagram, FaSpinner, FaUnlink, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import { motion } from "framer-motion";
// Removido import do logger, usar console.log no frontend
// import { logger } from '@/app/lib/logger';

interface InstagramConnectCardProps {
    // Props futuras, se necessário
}

const InstagramConnectCard: React.FC<InstagramConnectCardProps> = () => {
    // Hooks de estado e sessão
    const { data: session, status, update } = useSession(); // update é crucial para recarregar a sessão
    const [isLinking, setIsLinking] = useState(false); // Estado para carregamento da API de link (Conectar)
    const [linkError, setLinkError] = useState<string | null>(null); // Estado para erro da API de link (Conectar)
    const [isDisconnecting, setIsDisconnecting] = useState(false); // <<< NOVO >>> Estado para carregamento (Desconectar)
    const [disconnectError, setDisconnectError] = useState<string | null>(null); // <<< NOVO >>> Estado para erro (Desconectar)

    // Logs de depuração no console do navegador
    useEffect(() => {
        console.log("[InstagramConnectCard] Status da Sessão:", status);
        if (status === 'authenticated') {
            console.log("[InstagramConnectCard] Objeto Session:", JSON.stringify(session, null, 2));
            console.log("[InstagramConnectCard] Session User Provider:", session?.user?.provider);
            console.log("[InstagramConnectCard] Session User Instagram Connected:", session?.user?.instagramConnected);
        }
    }, [status, session]);

    // Variáveis de estado da sessão e conexão
    const isLoadingSession = status === 'loading';
    const isAuthenticated = status === 'authenticated';
    const isInstagramConnected = session?.user?.instagramConnected ?? false;

    console.log(`[InstagramConnectCard] Render Check: isLoadingSession=${isLoadingSession}, isAuthenticated=${isAuthenticated}, isInstagramConnected=${isInstagramConnected}`);

    // Função para iniciar a vinculação (Conectar)
    const handleConnectInstagram = async () => {
        setIsLinking(true);
        setLinkError(null);
        setDisconnectError(null); // Limpa erro de desconexão anterior
        console.log("[InstagramConnectCard] Iniciando processo de vinculação...");

        try {
            console.log("[InstagramConnectCard] Chamando POST /api/auth/iniciar-vinculacao-fb...");
            const response = await fetch('/api/auth/iniciar-vinculacao-fb', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            console.log("[InstagramConnectCard] Resposta da API de iniciar vinculação:", response.status, response.statusText);

            if (!response.ok) {
                let errorMessage = 'Falha ao iniciar a vinculação.';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (parseError) { /* Ignora erro de parsing */ }
                throw new Error(errorMessage);
            }

            console.log("[InstagramConnectCard] API de vinculação OK. Iniciando signIn('facebook')...");
            signIn('facebook', { callbackUrl: '/dashboard?linked=true' });

        } catch (error: any) {
            console.error("[InstagramConnectCard] Erro ao conectar Instagram:", error);
            setLinkError(error.message || 'Ocorreu um erro inesperado.');
            setIsLinking(false);
        }
    };

    // <<< FUNÇÃO ATUALIZADA >>> Função para desconectar Instagram
    const handleDisconnectInstagram = async () => {
        setIsDisconnecting(true);
        setDisconnectError(null);
        setLinkError(null); // Limpa erro de conexão anterior
        console.log("[InstagramConnectCard] Iniciando processo de desconexão...");

        try {
            console.log("[InstagramConnectCard] Chamando POST /api/instagram/disconnect...");
            const response = await fetch('/api/instagram/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            console.log("[InstagramConnectCard] Resposta da API de desconexão:", response.status, response.statusText);

            if (!response.ok) {
                let errorMessage = 'Falha ao desconectar.';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage; // Tenta pegar 'error' também
                } catch (parseError) { /* Ignora erro de parsing */ }
                throw new Error(errorMessage);
            }

            // Se a API foi sucesso (limpou no backend), força a atualização da sessão no frontend
            console.log("[InstagramConnectCard] API de desconexão OK. Atualizando sessão...");
            await update(); // Força o useSession a buscar os dados atualizados
            console.log("[InstagramConnectCard] Sessão atualizada após desconexão.");


        } catch (error: any) {
            console.error("[InstagramConnectCard] Erro ao desconectar Instagram:", error);
            setDisconnectError(error.message || 'Ocorreu um erro inesperado ao desconectar.');
        } finally {
            setIsDisconnecting(false); // Garante que o estado de loading termine
        }
    };

    // Variantes de animação (mantidas)
    const cardVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
    };

    // Condição de renderização principal
    if (isLoadingSession || !isAuthenticated) {
        console.log("[InstagramConnectCard] Não renderizando o card (sessão carregando ou não autenticada).");
        return null;
    }

    // Renderização do Card
    console.log("[InstagramConnectCard] Renderizando o card.");
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
                                Conecte sua conta profissional do Instagram para coletar métricas automaticamente.
                            </p>
                        </div>
                    </div>

                    {/* Botão e Status */}
                    <div className="flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                        {isInstagramConnected ? (
                            // --- Estado Conectado ---
                            <div className="flex flex-col sm:items-end items-center gap-2">
                                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full border border-green-200 whitespace-nowrap">
                                    <FaCheckCircle />
                                    Instagram Conectado
                                </span>
                                {/* <<< BOTÃO DESCONECTAR ATUALIZADO >>> */}
                                <button
                                    onClick={handleDisconnectInstagram}
                                    disabled={isDisconnecting} // Desabilita durante a ação
                                    title="Desconectar conta Instagram"
                                    className="px-3 py-1 bg-red-100 text-red-600 text-xs font-medium rounded hover:bg-red-200 border border-red-200 flex items-center justify-center gap-1 disabled:opacity-70 disabled:cursor-wait"
                                >
                                    {isDisconnecting ? (
                                        <FaSpinner className="animate-spin w-3 h-3" />
                                    ) : (
                                        <FaUnlink className="w-3 h-3" />
                                    )}
                                    {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                                </button>
                                {disconnectError && (
                                     <p className="text-xs text-red-600 mt-1 flex items-center gap-1 text-right">
                                         <FaExclamationCircle />
                                         {disconnectError}
                                     </p>
                                )}
                            </div>
                        ) : (
                            // --- Estado Desconectado ---
                            <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                                <button
                                    onClick={handleConnectInstagram}
                                    disabled={isLinking}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2 transition duration-150 ease-in-out disabled:opacity-70 disabled:cursor-wait"
                                >
                                    {isLinking ? (
                                        <FaSpinner className="animate-spin w-4 h-4" />
                                    ) : (
                                        <FaFacebook className="w-4 h-4" />
                                    )}
                                    {isLinking ? 'Iniciando...' : 'Conectar com Facebook'}
                                </button>
                                {linkError && (
                                     <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                                         <FaExclamationCircle />
                                         {linkError}
                                     </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Mensagem adicional */}
                <p className="text-xs text-gray-500 mt-4 border-t border-gray-100 pt-3">
                    {isInstagramConnected
                        ? "A coleta automática de métricas está ativa. Novos dados serão buscados periodicamente."
                        : "Clique em \"Conectar com Facebook\" para autorizar o acesso à sua conta do Instagram vinculada e automatizar a coleta."
                    }
                </p>
            </div>
        </motion.section>
    );
};

export default InstagramConnectCard;

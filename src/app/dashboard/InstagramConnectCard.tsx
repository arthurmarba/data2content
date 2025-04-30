// src/app/dashboard/InstagramConnectCard.tsx
"use client";

import React, { useEffect, useState } from 'react'; // Importa useState
import { useSession, signIn, signOut } from 'next-auth/react';
import { FaFacebook, FaInstagram, FaSpinner, FaUnlink, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import { motion } from "framer-motion";
import { logger } from '@/app/lib/logger'; // Importa o logger (se configurado no frontend)

interface InstagramConnectCardProps {
    // Props futuras, se necessário
}

const InstagramConnectCard: React.FC<InstagramConnectCardProps> = () => {
    const { data: session, status, update } = useSession(); // Adiciona update para forçar recarga da sessão
    const [isLinking, setIsLinking] = useState(false); // Estado para carregamento da API de link
    const [linkError, setLinkError] = useState<string | null>(null); // Estado para erro da API de link

    // --- LOGS PARA DEPURAÇÃO ---
    useEffect(() => {
        // Usando console.log pois logger pode não estar configurado no client-side
        console.log("[InstagramConnectCard] Status da Sessão:", status);
        if (status === 'authenticated') {
            console.log("[InstagramConnectCard] Objeto Session:", JSON.stringify(session, null, 2));
            console.log("[InstagramConnectCard] Session User Provider:", session?.user?.provider);
            console.log("[InstagramConnectCard] Session User Instagram Connected:", session?.user?.instagramConnected);
        }
    }, [status, session]);
    // -------------------------------------

    const isLoadingSession = status === 'loading';
    // Renderiza se autenticado (não importa mais se é Google ou não, a API de link verifica)
    const isAuthenticated = status === 'authenticated';

    const isInstagramConnected = session?.user?.instagramConnected ?? false;

    // Log da condição de renderização
    console.log(`[InstagramConnectCard] Render Check: isLoadingSession=${isLoadingSession}, isAuthenticated=${isAuthenticated}`);

    // Função para iniciar a vinculação
    const handleConnectInstagram = async () => {
        setIsLinking(true);
        setLinkError(null);
        console.log("[InstagramConnectCard] Iniciando processo de vinculação...");

        try {
            // 1. Chama a API para gerar o token de link e o cookie
            console.log("[InstagramConnectCard] Chamando POST /api/auth/iniciar-vinculacao-fb...");
            const response = await fetch('/api/auth/iniciar-vinculacao-fb', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', // Mesmo sem corpo, é boa prática
                },
            });

            console.log("[InstagramConnectCard] Resposta da API:", response.status, response.statusText);

            if (!response.ok) {
                // Tenta pegar mensagem de erro do corpo da resposta
                let errorMessage = 'Falha ao iniciar a vinculação.';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (parseError) {
                    // Ignora erro de parsing se não for JSON
                }
                throw new Error(errorMessage);
            }

            // 2. Se a API foi sucesso, inicia o fluxo OAuth do Facebook
            console.log("[InstagramConnectCard] API de vinculação OK. Iniciando signIn('facebook')...");
            signIn('facebook', {
                // Redireciona de volta para o dashboard após o fluxo do Facebook
                // Isso ajuda a garantir que a sessão seja atualizada corretamente
                callbackUrl: '/dashboard?linked=true' // Adiciona um parâmetro para possível feedback
            });
            // Não definimos isLinking como false aqui, pois a página será recarregada

        } catch (error: any) {
            console.error("[InstagramConnectCard] Erro ao conectar Instagram:", error);
            setLinkError(error.message || 'Ocorreu um erro inesperado.');
            setIsLinking(false); // Define como false em caso de erro
        }
        // Não precisamos do finally setIsLinking(false) porque o signIn recarrega a página
    };

    // Função para desconectar (placeholder)
    const handleDisconnectInstagram = async () => {
        alert("Funcionalidade de desconectar Instagram ainda não implementada.");
        // Lógica futura:
        // 1. Chamar uma API de backend para:
        //    - Limpar facebookProviderAccountId, instagramAccessToken, instagramAccountId no DB
        //    - Definir isInstagramConnected = false
        // 2. Chamar update() do useSession para forçar a atualização da sessão no frontend
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
    };

    // Condição de renderização: Só mostra se estiver autenticado
    if (isLoadingSession || !isAuthenticated) {
        console.log("[InstagramConnectCard] Não renderizando o card (sessão carregando ou não autenticada).");
        return null; // Não mostra nada se estiver carregando ou não logado
    }

    // Se passou pela condição, renderiza o card
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
                            // Estado Conectado
                            <div className="flex flex-col sm:items-end items-center gap-2">
                                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full border border-green-200 whitespace-nowrap">
                                    <FaCheckCircle />
                                    Instagram Conectado
                                </span>
                                {/* Botão Desconectar (ainda desabilitado) */}
                                <button
                                    onClick={handleDisconnectInstagram}
                                    title="Desconectar conta Instagram"
                                    className="px-3 py-1 bg-red-100 text-red-600 text-xs font-medium rounded hover:bg-red-200 border border-red-200 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled // MANTIDO DESABILITADO POR ENQUANTO
                                >
                                    <FaUnlink className="w-3 h-3" />
                                    Desconectar
                                </button>
                            </div>
                        ) : (
                            // Estado Desconectado
                            <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                                <button
                                    onClick={handleConnectInstagram}
                                    disabled={isLinking} // Desabilita durante a chamada da API
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

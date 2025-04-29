// src/app/dashboard/InstagramConnectCard.tsx
"use client";

import React, { useEffect } from 'react'; // Importa useEffect para os logs
import { useSession, signIn, signOut } from 'next-auth/react';
import { FaFacebook, FaInstagram, FaSpinner, FaUnlink, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import { motion } from "framer-motion";

interface InstagramConnectCardProps {
    // Props futuras, se necessário
}

const InstagramConnectCard: React.FC<InstagramConnectCardProps> = () => {
    const { data: session, status } = useSession();

    // --- LOGS PARA DEPURAÇÃO NA VERCEL ---
    useEffect(() => {
        console.log("[InstagramConnectCard] Status da Sessão:", status);
        if (status === 'authenticated') {
            console.log("[InstagramConnectCard] Objeto Session:", JSON.stringify(session, null, 2));
            console.log("[InstagramConnectCard] Session User Provider:", session?.user?.provider);
            console.log("[InstagramConnectCard] Session User Instagram Connected:", session?.user?.instagramConnected);
        }
    }, [status, session]);
    // -------------------------------------

    const isLoading = status === 'loading';
    const isLoggedInViaGoogle = status === 'authenticated' && session?.user?.provider === 'google';

    const isInstagramConnected = session?.user?.instagramConnected ?? false;

    // Log da condição de renderização
    console.log(`[InstagramConnectCard] Render Check: isLoading=${isLoading}, isLoggedInViaGoogle=${isLoggedInViaGoogle}`);

    const handleConnectInstagram = () => { signIn('facebook'); };
    const handleDisconnectInstagram = () => { alert("Funcionalidade de desconectar Instagram ainda não implementada."); };

    const cardVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
    };

    // Condição de renderização (mantida)
    if (isLoading || !isLoggedInViaGoogle) {
        console.log("[InstagramConnectCard] Não renderizando o card."); // Log adicional
        return null;
    }

    // Se passou pela condição, renderiza o card
    console.log("[InstagramConnectCard] Renderizando o card."); // Log adicional
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
                                <button
                                    onClick={handleDisconnectInstagram}
                                    title="Desconectar conta Instagram"
                                    className="px-3 py-1 bg-red-100 text-red-600 text-xs font-medium rounded hover:bg-red-200 border border-red-200 flex items-center gap-1 disabled:opacity-50"
                                    disabled
                                >
                                    <FaUnlink className="w-3 h-3" />
                                    Desconectar
                                </button>
                            </div>
                        ) : (
                            // Estado Desconectado
                            <button
                                onClick={handleConnectInstagram}
                                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2 transition duration-150 ease-in-out"
                            >
                                <FaFacebook className="w-4 h-4" />
                                Conectar com Facebook
                            </button>
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

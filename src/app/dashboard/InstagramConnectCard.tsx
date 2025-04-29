// src/app/dashboard/InstagramConnectCard.tsx
"use client";

import React from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { FaFacebook, FaInstagram, FaSpinner, FaUnlink, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa'; // Adicionado FaCheckCircle
import { motion } from "framer-motion"; // Para animação do card

// Interface para as props do componente (pode ser expandida se necessário)
interface InstagramConnectCardProps {
    // Pode receber props adicionais se precisar interagir com o Dashboard pai
}

const InstagramConnectCard: React.FC<InstagramConnectCardProps> = () => {
    const { data: session, status } = useSession();

    // Verifica se a sessão está carregando
    const isLoading = status === 'loading';
    // Verifica se o usuário está autenticado via Google (assumindo Google como provider principal)
    const isLoggedInViaGoogle = status === 'authenticated' && session?.provider === 'google';

    // --- Lógica de Verificação da Conexão com Instagram ATUALIZADA ---
    // Usa o campo 'instagramConnected' que adicionamos à sessão no callback do NextAuth
    // O '?? false' garante que será false se session, user ou o campo não existirem
    const isInstagramConnected = session?.user?.instagramConnected ?? false;
    // -----------------------------------------------------------------

    // Função para iniciar o login com o Facebook (para conectar Instagram)
    const handleConnectInstagram = () => {
        signIn('facebook');
    };

    // Função para desconectar (placeholder - requer lógica de backend)
    const handleDisconnectInstagram = () => {
        alert("Funcionalidade de desconectar Instagram ainda não implementada.");
        // Implementação futura: Chamar API de backend para invalidar token IG
    };

    // Animação do card (pode ser passada como prop ou definida aqui)
    const cardVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
    };

    // Não renderiza nada se não estiver logado via Google ou se a sessão inicial estiver carregando
    if (isLoading || !isLoggedInViaGoogle) {
        // Retorna null para não mostrar nada enquanto carrega ou se não for usuário Google
        return null;
    }

    return (
        <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={1.5}> {/* Ajuste o 'custom' para o delay desejado */}
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
                        {isInstagramConnected ? ( // <<< AGORA USA O VALOR REAL DA SESSÃO
                            // Estado Conectado
                            <div className="flex flex-col sm:items-end items-center gap-2">
                                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full border border-green-200 whitespace-nowrap">
                                    <FaCheckCircle /> {/* Ícone de sucesso */}
                                    Instagram Conectado
                                </span>
                                <button
                                    onClick={handleDisconnectInstagram}
                                    title="Desconectar conta Instagram"
                                    className="px-3 py-1 bg-red-100 text-red-600 text-xs font-medium rounded hover:bg-red-200 border border-red-200 flex items-center gap-1 disabled:opacity-50"
                                    disabled // Habilitar quando a função for implementada
                                >
                                    <FaUnlink className="w-3 h-3" />
                                    Desconectar
                                </button>
                            </div>

                        ) : (
                            // Estado Desconectado - Mostra o botão para conectar
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


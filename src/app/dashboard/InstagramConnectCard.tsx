"use client";

import React, { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { FaFacebook, FaInstagram, FaSpinner, FaUnlink, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import { motion } from 'framer-motion';
import type { AvailableInstagramAccount } from '@/app/lib/instagramService'; // Garanta que o caminho está correto
import type { Session } from 'next-auth';

interface InstagramConnectCardProps {}

// Tipo estendido para a sessão, incluindo campos do Instagram
type BaseUserType = NonNullable<Session['user']>;
type SessionUserWithInstagram = BaseUserType & {
  instagramConnected?: boolean;
  availableIgAccounts?: AvailableInstagramAccount[] | null; // Mantido para info/debug
  igConnectionError?: string | null;
  instagramAccountId?: string | null;
  instagramUsername?: string | null;
};

const InstagramConnectCard: React.FC<InstagramConnectCardProps> = () => {
  // Hooks de sessão e estado local
  const { data: session, status, update } = useSession();
  const [isLinking, setIsLinking] = useState(false); // Estado de carregamento para iniciar conexão FB
  const [linkError, setLinkError] = useState<string | null>(null); // Erro local ao iniciar conexão FB
  const [isDisconnecting, setIsDisconnecting] = useState(false); // Estado de carregamento para desconectar
  const [disconnectError, setDisconnectError] = useState<string | null>(null); // Erro local ao desconectar

  // Variáveis derivadas do estado da sessão
  const isLoadingSession = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  const user = session?.user as SessionUserWithInstagram | undefined;
  const isInstagramConnected = user?.instagramConnected ?? false;

  // REMOVIDO - Lógica showSelectionUI e availableAccounts não são mais usados para renderização condicional principal

  // Função para obter a mensagem de erro a ser exibida
  const getDisplayError = (): string | null => {
    // Prioriza erros locais (desconexão, link) e depois erros da sessão (backend)
    if (disconnectError) return `Erro ao desconectar: ${disconnectError}`;
    if (linkError) return `Erro ao iniciar: ${linkError}`; // Erro local ao clicar no botão
    if (user?.igConnectionError) {
      // Traduz mensagens de erro comuns vindas do backend
      if (user.igConnectionError.includes('Nenhuma conta IG Business/Creator vinculada encontrada'))
        return 'Nenhuma conta Instagram profissional encontrada ou selecionada.';
      if (user.igConnectionError.includes('Permissão') || user.igConnectionError.includes('ausente'))
        return 'Permissão necessária não concedida. Refaça a conexão.';
      if (user.igConnectionError.includes('Token') || user.igConnectionError.includes('expirado'))
        return 'Sessão expirada ou inválida. Conecte novamente.';
      if (user.igConnectionError.includes('Usuário não identificado'))
        return 'Faça login com Google antes de conectar o Instagram.';
      // Outros erros vindos do backend
      return `Erro de conexão: ${user.igConnectionError}`;
    }
    return null; // Sem erro
  };
  const displayError = getDisplayError();

  // Manipulador para iniciar o fluxo de vinculação/login com Facebook
  const handleInitiateFacebookLink = async () => {
    setIsLinking(true);
    setLinkError(null);
    setDisconnectError(null);
    // Limpar o erro da sessão exigiria chamar update(), mas o signIn redireciona de qualquer forma.
    // O erro será limpo (ou atualizado) no próximo carregamento da sessão após o callback do FB.

    try {
      // Chama a API interna para gerar o link token (se necessário para vincular)
      const res = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Falha ao preparar vinculação');
      }
      // Inicia o fluxo de login do NextAuth com o provedor 'facebook'
      // O backend agora conecta automaticamente a conta encontrada.
      signIn('facebook', { callbackUrl: '/dashboard' });
    } catch (e: any) {
      console.error('[InstagramConnectCard] Erro ao iniciar vinculação:', e);
      setLinkError(e.message || 'Erro inesperado');
      setIsLinking(false); // Reseta estado de carregamento apenas em caso de erro *antes* do signIn
    }
    // Não reseta isLinking aqui, pois o signIn redireciona
  };

  // Manipulador para desconectar a conta do Instagram
  const handleDisconnectInstagram = async () => {
    setIsDisconnecting(true);
    setDisconnectError(null);
    setLinkError(null);

    try {
      // Chama a API de desconexão no backend
      const res = await fetch('/api/instagram/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Falha ao desconectar');
      }
      // Força a atualização da sessão para refletir o estado desconectado
      await update();
    } catch (e: any) {
      console.error('[InstagramConnectCard] Erro ao desconectar:', e);
      setDisconnectError(e.message || 'Erro ao desconectar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Não renderiza nada se a sessão estiver carregando ou se não estiver autenticado
  if (isLoadingSession || !isAuthenticated) return null;

  // Renderização principal do componente
  return (
    <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Automação de Métricas</h2>
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Informações da Conta */}
          <div className="flex items-center gap-3">
            <FaInstagram className="w-8 h-8 text-pink-600" />
            <div>
              <h3 className="font-semibold text-lg text-gray-800">Instagram Insights</h3>
              <p className="text-sm text-gray-500 mt-1">
                {isInstagramConnected
                  ? `Conectado como: ${user?.instagramUsername ?? user?.instagramAccountId}` // Mostra username ou ID
                  : 'Conecte sua conta profissional do Instagram.'}
              </p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
            {isInstagramConnected ? (
              // --- Estado Conectado ---
              <div className="flex flex-col sm:items-end items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                  <FaCheckCircle /> Conectado
                </span>
                <button
                  onClick={handleDisconnectInstagram}
                  disabled={isDisconnecting}
                  className="px-3 py-1 bg-red-100 text-red-600 text-xs font-medium rounded hover:bg-red-200 border border-red-200 flex items-center justify-center gap-1 disabled:opacity-70 disabled:cursor-wait"
                >
                  {isDisconnecting ? <FaSpinner className="animate-spin w-3 h-3" /> : <FaUnlink className="w-3 h-3" />}
                  {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                </button>
                {/* Exibe erro local de desconexão */}
                {disconnectError && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><FaExclamationCircle /> {disconnectError}</p>}
              </div>
            ) : (
              // --- Estado Desconectado ---
              <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                {/* Botão principal: Conectar ou Tentar Novamente se houver erro */}
                <button
                  onClick={handleInitiateFacebookLink}
                  disabled={isLinking}
                  className={`w-full sm:w-auto px-5 py-2.5 text-sm rounded-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait ${
                    displayError ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white' // Estilo diferente se for retry
                  }`}
                >
                  {isLinking ? <FaSpinner className="animate-spin w-4 h-4" /> : <FaFacebook className="w-4 h-4" />}
                  {isLinking ? 'Iniciando...' : (displayError ? 'Tentar Conectar Novamente' : 'Conectar com Facebook')}
                </button>
                {/* Exibe erro (local ou da sessão) */}
                {displayError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1 max-w-xs"><FaExclamationCircle /> {displayError}</p>}
              </div>
            )}
          </div>
        </div>
        {/* Texto de Ajuda Inferior (Atualizado) */}
        <p className="text-xs text-gray-500 mt-4 border-t pt-3">
          {isInstagramConnected
            ? 'A coleta automática de métricas está ativa.'
            : displayError
            ? 'Ocorreu um erro durante a conexão. Verifique as permissões no Facebook ou tente novamente.' // Mensagem de erro genérica
            : 'Clique em "Conectar com Facebook" para autorizar o acesso à sua conta profissional do Instagram. A conexão será automática.'}
        </p>
      </div>
    </motion.section>
  );
};

export default InstagramConnectCard;

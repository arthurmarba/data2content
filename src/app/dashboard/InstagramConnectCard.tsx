"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useSession, signIn } from 'next-auth/react';
import {
  FaFacebook,
  FaInstagram,
  FaSpinner,
  FaUnlink,
  FaExclamationCircle,
  FaCheckCircle,
  FaLock,
  FaKey,
  FaClock,
  FaExclamationTriangle,
  FaSync,
  FaInfoCircle
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import type { AvailableInstagramAccount } from '@/app/lib/instagramService'; // Garanta que o caminho está correto
import type { Session } from 'next-auth';
import { format } from 'date-fns'; // Para formatar datas
import { ptBR } from 'date-fns/locale'; // Para localização em português

// Props do componente atualizadas
interface InstagramConnectCardProps {
  canAccessFeatures: boolean;
  onActionRedirect: () => void;
  showToast: (message: string, type?: 'info' | 'warning' | 'success' | 'error') => void;
}

// Logger simples para o lado do cliente
const logger = {
    debug: (...args: any[]) => console.debug('[CLIENT DEBUG]', ...args),
    info: (...args: any[]) => console.info('[CLIENT INFO]', ...args),
    warn: (...args: any[]) => console.warn('[CLIENT WARN]', ...args),
    error: (...args: any[]) => console.error('[CLIENT ERROR]', ...args),
};

// Tipo estendido para a sessão, incluindo campos do Instagram e de sincronização
type BaseUserType = NonNullable<Session['user']>;
type SessionUserWithInstagram = BaseUserType & {
  instagramConnected?: boolean;
  availableIgAccounts?: AvailableInstagramAccount[] | null;
  igConnectionError?: string | null;
  instagramAccountId?: string | null;
  instagramUsername?: string | null;
  lastInstagramSyncAttempt?: string | null;
  lastInstagramSyncSuccess?: boolean | null;
};

// Tipos para erros contextuais
type ErrorType = 'permission' | 'token' | 'general_backend' | 'local_linking' | 'local_disconnect' | 'sync_failed' | 'no_ig_account';

interface DisplayError {
  message: string;
  type: ErrorType;
  icon: React.ElementType;
  colorClasses: string;
}

const InstagramConnectCard: React.FC<InstagramConnectCardProps> = ({
  canAccessFeatures,
  onActionRedirect,
  showToast,
}) => {
  const { data: session, status, update } = useSession();
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null); // Erro local do processo de link
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null); // Erro local do processo de disconnect
  const [showSuccessToastFromCard, setShowSuccessToastFromCard] = useState<string | null>(null); // Renomeado para evitar conflito com prop showToast


  const isLoadingSession = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  const user = session?.user as SessionUserWithInstagram | undefined;

  // Para assinantes, isInstagramConnected reflete o status real da sessão.
  // Para não assinantes, vamos considerar como "não conectado" para a lógica da UI,
  // pois eles não podem usar a conexão de qualquer forma.
  const isEffectivelyInstagramConnected = canAccessFeatures && (user?.instagramConnected ?? false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('instagramLinked') === 'true' || urlParams.get('instagramDisconnected') === 'true') {
      logger.info("[InstagramConnectCard] Parâmetro de URL detectado. Forçando atualização da sessão.");
      update(); // Atualiza a sessão para refletir o novo estado
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl); // Limpa os parâmetros da URL
    }
  }, [update]);

  useEffect(() => {
    if (showSuccessToastFromCard) {
      const timer = setTimeout(() => {
        setShowSuccessToastFromCard(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showSuccessToastFromCard]);

  // Erros de conexão da sessão (user.igConnectionError) são mais relevantes para assinantes.
  // Para não assinantes, o linkError local (falha ao tentar iniciar o fluxo) é mais provável, mas a ação será redirecionar.
  const currentDisplayError = useMemo((): DisplayError | null => {
    if (!canAccessFeatures) return null; // Não mostrar erros de API para não assinantes, pois a ação é redirecionar

    if (disconnectError) return { message: disconnectError, type: 'local_disconnect', icon: FaExclamationCircle, colorClasses: 'text-red-600 bg-red-50 border-red-200' };
    if (linkError) return { message: linkError, type: 'local_linking', icon: FaExclamationCircle, colorClasses: 'text-red-600 bg-red-50 border-red-200' };
    
    if (user?.igConnectionError) {
      const errorMsg = user.igConnectionError;
      if (errorMsg.includes('Nenhuma conta IG Business/Creator vinculada encontrada'))
        return { message: 'Nenhuma conta Instagram profissional foi encontrada ou selecionada em sua conta do Facebook.', type: 'no_ig_account', icon: FaExclamationTriangle, colorClasses: 'text-yellow-700 bg-yellow-50 border-yellow-300' };
      if (errorMsg.includes('Permissão') || errorMsg.includes('ausente') || errorMsg.includes('(#10)') || errorMsg.includes('(#200)'))
        return { message: 'Permissão necessária não concedida pelo Facebook. Por favor, reconecte e certifique-se de aprovar todas as permissões solicitadas.', type: 'permission', icon: FaLock, colorClasses: 'text-yellow-700 bg-yellow-50 border-yellow-300' };
      if (errorMsg.includes('Token') || errorMsg.includes('expirado') || errorMsg.includes('inválido'))
        return { message: 'Sua sessão com o Facebook expirou ou é inválida. Por favor, conecte novamente.', type: 'token', icon: FaKey, colorClasses: 'text-orange-600 bg-orange-50 border-orange-300' };
      if (errorMsg.includes('Usuário não identificado')) // Este erro é do nosso backend
        return { message: 'Você precisa estar logado na plataforma antes de conectar o Instagram.', type: 'local_linking', icon: FaExclamationCircle, colorClasses: 'text-red-600 bg-red-50 border-red-200' };
      return { message: `Erro de conexão: ${errorMsg}`, type: 'general_backend', icon: FaExclamationTriangle, colorClasses: 'text-red-600 bg-red-50 border-red-200' };
    }
    return null;
  }, [disconnectError, linkError, user?.igConnectionError, canAccessFeatures]);

  const handleInitiateFacebookLink = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!canAccessFeatures) {
      event.preventDefault();
      showToast("Conecte seu Instagram e automatize suas métricas com um plano premium.", 'info');
      onActionRedirect();
      return;
    }

    // Lógica para assinantes
    setIsLinking(true);
    setLinkError(null);
    setDisconnectError(null); // Limpa erro de desconexão anterior

    // Limpa erros da sessão localmente antes de tentar novamente, se for assinante
    if (user?.igConnectionError || user?.availableIgAccounts) {
      logger.debug("[InstagramConnectCard] Limpando erros da sessão (igConnectionError, availableIgAccounts) localmente antes de iniciar vinculação FB.");
      await update({
          ...session,
          user: { // Preserva outros campos do usuário
              ...user,
              igConnectionError: undefined, // Limpa o erro específico
              availableIgAccounts: undefined, // Limpa contas disponíveis
          }
      });
    }

    try {
      logger.info("[InstagramConnectCard] Assinante: Chamando /api/auth/iniciar-vinculacao-fb");
      const res = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Falha ao preparar vinculação (resposta não-JSON).' }));
        logger.error("[InstagramConnectCard] Assinante: Erro ao chamar /api/auth/iniciar-vinculacao-fb:", errData);
        throw new Error(errData.message || 'Falha ao preparar vinculação com Facebook.');
      }
      logger.info("[InstagramConnectCard] Assinante: /api/auth/iniciar-vinculacao-fb OK. Iniciando signIn('facebook').");
      // O callbackUrl já inclui o parâmetro para forçar o update da sessão
      signIn('facebook', { callbackUrl: '/dashboard?instagramLinked=true' });
    } catch (e: any) {
      logger.error('[InstagramConnectCard] Assinante: Erro ao iniciar vinculação:', e);
      setLinkError(e.message || 'Erro inesperado ao tentar conectar com Facebook.');
      setIsLinking(false);
    }
    // Não definimos setIsLinking(false) aqui porque o signIn('facebook') causa um redirecionamento.
    // O estado de linking será resetado se o usuário voltar para a página sem completar,
    // ou se houver um erro antes do redirecionamento.
  };

  const handleDisconnectInstagram = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // Esta ação é primariamente para assinantes.
    if (!canAccessFeatures) {
       event.preventDefault();
       showToast("Gerencie sua conexão com o Instagram ao assinar um plano.", 'info');
       onActionRedirect();
       return;
    }

    // Lógica para assinantes
    setIsDisconnecting(true);
    setDisconnectError(null);
    setLinkError(null); // Limpa erro de conexão anterior

    try {
      logger.info("[InstagramConnectCard] Assinante: Chamando /api/instagram/disconnect");
      const res = await fetch('/api/instagram/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Falha ao desconectar (resposta não-JSON).' }));
        logger.error("[InstagramConnectCard] Assinante: Erro ao chamar /api/instagram/disconnect:", errData);
        throw new Error(errData.message || 'Falha ao desconectar Instagram.');
      }
      logger.info("[InstagramConnectCard] Assinante: /api/instagram/disconnect OK. Forçando atualização da sessão.");
      await update(); // Atualiza a sessão para refletir a desconexão
      setShowSuccessToastFromCard("Instagram desconectado com sucesso!"); // Usa o toast interno do card
    } catch (e: any) {
      logger.error('[InstagramConnectCard] Assinante: Erro ao desconectar:', e);
      setDisconnectError(e.message || 'Erro ao tentar desconectar Instagram.');
    } finally {
      setIsDisconnecting(false);
    }
  };
  
  const lastSyncAttemptDate = user?.lastInstagramSyncAttempt ? new Date(user.lastInstagramSyncAttempt) : null;
  const formattedLastSyncAttempt = lastSyncAttemptDate 
    ? format(lastSyncAttemptDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : 'N/A';

  if (isLoadingSession && !session) { // Mostra loader apenas se a sessão inicial ainda não carregou
    return (
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Automação de Métricas</h2>
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg text-center text-gray-500 flex items-center justify-center">
          <FaSpinner className="animate-spin w-6 h-6 mr-3" /> Carregando dados da conexão...
        </div>
      </motion.section>
    );
  }
  // Não retorna null se !isAuthenticated, pois o MainDashboard já trata o redirecionamento para /login
  // Se chegar aqui e !isAuthenticated, algo está errado no fluxo de autenticação.

  // Determina o texto do botão principal e se ele deve parecer "tentar novamente"
  let mainButtonText = "Conectar com Facebook";
  let mainButtonIcon = <FaFacebook className="w-5 h-5" />;
  let mainButtonStyles = "bg-blue-600 hover:bg-blue-700 text-white";

  if (canAccessFeatures && isLinking) {
    mainButtonText = "Iniciando...";
    mainButtonIcon = <FaSpinner className="animate-spin w-5 h-5" />;
  } else if (canAccessFeatures && currentDisplayError) {
    mainButtonText = "Tentar Novamente";
    mainButtonStyles = "bg-yellow-500 hover:bg-yellow-600 text-white";
  }


  return (
    <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}> {/* Adicionado delay */}
      <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Automação de Métricas</h2>
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg relative">
        
        <AnimatePresence>
          {showSuccessToastFromCard && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
              className="absolute top-0 left-1/2 -translate-x-1/2 mt-4 bg-green-500 text-white text-sm px-4 py-2 rounded-md shadow-lg z-50"
            >
              {showSuccessToastFromCard}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FaInstagram className="w-10 h-10 text-pink-600" />
            <div>
              <h3 className="font-semibold text-lg text-gray-800">Instagram Insights</h3>
              <p className="text-sm text-gray-500 mt-1">
                {isEffectivelyInstagramConnected
                  ? `Conectado como: ${user?.instagramUsername || user?.instagramAccountId || 'Conta Vinculada'}`
                  : 'Conecte sua conta profissional do Instagram.'}
              </p>
            </div>
          </div>

          <div className="flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
            {isEffectivelyInstagramConnected ? (
              // Se for assinante e conectado, mostra status e botão de desconectar
              <div className="flex flex-col sm:items-end items-center gap-2">
                <motion.span 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-1.5 text-sm text-green-700 bg-green-100 px-3 py-1.5 rounded-full border border-green-300 font-medium"
                >
                  <FaCheckCircle /> Conectado
                </motion.span>
                <button
                  onClick={handleDisconnectInstagram}
                  disabled={isDisconnecting}
                  className="px-4 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-md hover:bg-red-200 border border-red-300 flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-wait transition-colors duration-150"
                >
                  {isDisconnecting ? <FaSpinner className="animate-spin w-3 h-3" /> : <FaUnlink className="w-3 h-3" />}
                  {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                </button>
              </div>
            ) : (
              // Se não for assinante OU for assinante mas não conectado, mostra o botão principal de conexão/tentativa
              <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                <button
                  onClick={handleInitiateFacebookLink} // A lógica de bloqueio para não assinantes está aqui
                  // O botão só fica realmente desabilitado (e com estilo de loading)
                  // se for um assinante e o processo de link estiver em andamento.
                  disabled={canAccessFeatures && (isLinking || isLoadingSession)}
                  className={`w-full sm:w-auto px-6 py-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2.5 
                              transition-all duration-150 ease-in-out transform hover:scale-105 shadow-md hover:shadow-lg
                              ${(canAccessFeatures && (isLinking || isLoadingSession)) ? 'opacity-70 cursor-wait' : ''}
                              ${mainButtonStyles} 
                            `}
                >
                  {mainButtonIcon}
                  {mainButtonText}
                </button>
              </div>
            )}
          </div>
        </div>
        
        <AnimatePresence>
          {canAccessFeatures && currentDisplayError && ( // Mostra erros de API apenas para assinantes
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`mt-4 p-3 border rounded-md text-xs flex items-start gap-2 ${currentDisplayError.colorClasses}`}
            >
              <currentDisplayError.icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{currentDisplayError.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Informações de Sincronização só para assinantes conectados */}
        {isEffectivelyInstagramConnected && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="mt-4 text-xs text-gray-600 border-t pt-3"
          >
            <div className="flex items-center gap-2">
              <FaInfoCircle className="text-blue-500"/>
              <span>
                Última tentativa de sincronização: {formattedLastSyncAttempt}.
              </span>
              {user?.lastInstagramSyncSuccess === true && <FaCheckCircle className="text-green-500" title="Sucesso"/>}
              {user?.lastInstagramSyncSuccess === false && <FaExclamationCircle className="text-red-500" title="Falha"/>}
              {/* Considerar o caso de user?.lastInstagramSyncSuccess ser undefined ou null como pendente/desconhecido */}
              {user?.lastInstagramSyncSuccess === null && user?.lastInstagramSyncAttempt && <FaClock className="text-gray-500" title="Status desconhecido ou pendente"/>}
            </div>
            {user?.lastInstagramSyncSuccess === false && (
              <p className="mt-1 text-red-600">Houve uma falha na última sincronização. Se o problema persistir, tente desconectar e reconectar sua conta.</p>
            )}
          </motion.div>
        )}

        {/* Texto informativo geral abaixo */}
        <p className={`text-xs text-gray-500 mt-4 ${isEffectivelyInstagramConnected ? '' : 'border-t pt-3'}`}>
          {isEffectivelyInstagramConnected
            ? 'A coleta automática de métricas está ativa para sua conta conectada.'
            : 'Conecte sua conta profissional do Instagram para habilitar a automação de métricas e receber análises detalhadas com um plano premium.'
          }
        </p>
      </div>
    </motion.section>
  );
};

export default InstagramConnectCard;

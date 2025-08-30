// InstagramConnectCard.tsx
// VERSÃO CORRIGIDA v4: Atualizado o texto descritivo para ser mais amigável e focado na automação.
// Mantém a lógica de conexão e a supressão de erro de "audience demographics".

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  FaInfoCircle,
  FaListUl, 
  FaTimes
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
// ATUALIZAÇÃO DA IMPORTAÇÃO para a nova estrutura modular
import type { AvailableInstagramAccount } from '@/app/lib/instagram/types';
import type { Session } from 'next-auth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InstagramConnectCardProps {
  canAccessFeatures: boolean;
  onActionRedirect: () => void;
  showToast: (message: string, type?: 'info' | 'warning' | 'success' | 'error') => void;
}

const logger = {
    debug: (...args: any[]) => console.debug('[CLIENT DEBUG][InstagramConnectCard]', ...args),
    info: (...args: any[]) => console.info('[CLIENT INFO][InstagramConnectCard]', ...args),
    warn: (...args: any[]) => console.warn('[CLIENT WARN][InstagramConnectCard]', ...args),
    error: (...args: any[]) => console.error('[CLIENT ERROR][InstagramConnectCard]', ...args),
};

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

type ErrorType = 'permission' | 'token' | 'general_backend' | 'local_linking' | 'local_disconnect' | 'sync_failed' | 'no_ig_account' | 'account_selection';

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
  const [linkError, setLinkError] = useState<string | null>(null);
  
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  
  const [showSuccessToastFromCard, setShowSuccessToastFromCard] = useState<string | null>(null);

  const [showAccountSelectorModal, setShowAccountSelectorModal] = useState(false);
  const [isConnectingSelectedAccount, setIsConnectingSelectedAccount] = useState(false);
  const [accountSelectionError, setAccountSelectionError] = useState<string | null>(null);

  const isLoadingSession = status === 'loading';
  const user = session?.user as SessionUserWithInstagram | undefined;
  const isEffectivelyInstagramConnected = canAccessFeatures && (user?.instagramConnected ?? false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const instagramLinkedDetected = urlParams.get('instagramLinked') === 'true';
    const instagramDisconnectedDetected = urlParams.get('instagramDisconnected') === 'true';

    if (instagramLinkedDetected || instagramDisconnectedDetected) {
      logger.info("Parâmetro de URL 'instagramLinked' ou 'instagramDisconnected' detectado. Forçando atualização da sessão.");
      
      const currentPath = window.location.pathname;
      let searchParamsClean = new URLSearchParams(window.location.search);
      searchParamsClean.delete('instagramLinked');
      searchParamsClean.delete('instagramDisconnected');
      const newSearch = searchParamsClean.toString();
      const newUrl = currentPath + (newSearch ? `?${newSearch}` : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);

      update().then(updatedSessionData => {
        const updatedUser = updatedSessionData?.user as SessionUserWithInstagram | undefined;
        logger.info("Sessão atualizada. User:", updatedUser);

        if (instagramLinkedDetected && updatedUser && !updatedUser.instagramConnected) {
          if (updatedUser.igConnectionError) {
            logger.warn(`Erro prévio ao buscar contas IG: ${updatedUser.igConnectionError}`);
            // O erro já será exibido pelo currentDisplayError, não precisa setar linkError aqui
          } else if (updatedUser.availableIgAccounts && updatedUser.availableIgAccounts.length > 0) {
            if (updatedUser.availableIgAccounts.length === 1) {
              const firstAccount = updatedUser.availableIgAccounts[0];
              if (firstAccount && firstAccount.igAccountId) {
                logger.info("Apenas uma conta IG disponível, conectando automaticamente:", firstAccount);
                handleConnectSelectedAccount(firstAccount.igAccountId);
              } else {
                logger.error("Primeira conta em availableIgAccounts é inválida ou não possui igAccountId, apesar das verificações de tamanho.");
                setLinkError("Erro ao processar a conta do Instagram disponível. Tente novamente.");
              }
            } else {
              logger.info("Múltiplas contas IG disponíveis. Mostrando modal de seleção.");
              setShowAccountSelectorModal(true);
            }
          } else {
            logger.warn("Nenhuma conta IG profissional encontrada ou disponível após vinculação com Facebook.");
            if (!updatedUser.igConnectionError) { // Só mostra essa mensagem se não houver um erro mais específico da API
                setLinkError("Nenhuma conta profissional do Instagram foi encontrada vinculada à sua conta do Facebook. Verifique se sua conta é comercial ou de criador de conteúdo.");
            }
          }
        } else if (updatedUser?.instagramConnected) {
            logger.info("Instagram já conectado após atualização da sessão.");
        }
      }).catch(err => {
        logger.error("Erro ao forçar atualização da sessão:", err);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]); // Removido 'update' da lista de dependências para evitar loops se 'update' mudar de referência frequentemente

  useEffect(() => {
    if (showSuccessToastFromCard) {
      const timer = setTimeout(() => setShowSuccessToastFromCard(null), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showSuccessToastFromCard]);

  const currentDisplayError = useMemo((): DisplayError | null => {
    if (!canAccessFeatures) return null;

    if (disconnectError) return { message: disconnectError, type: 'local_disconnect', icon: FaExclamationCircle, colorClasses: 'text-red-600 bg-red-50 border-red-200' };
    if (accountSelectionError) return { message: accountSelectionError, type: 'account_selection', icon: FaExclamationCircle, colorClasses: 'text-red-600 bg-red-50 border-red-200' };
    if (linkError) return { message: linkError, type: 'local_linking', icon: FaExclamationCircle, colorClasses: 'text-red-600 bg-red-50 border-red-200' };
    
    if (user?.igConnectionError) {
      const errorMsg = user.igConnectionError;

      // Se o erro for sobre "audience demographics", não exibe nenhuma mensagem.
      if (errorMsg.toLowerCase().includes('fetch audience demographics')) {
        return null;
      }

      if (errorMsg.includes('Nenhuma conta IG Business/Creator vinculada encontrada') || errorMsg.includes('Nenhuma conta profissional do Instagram foi encontrada'))
        return { message: 'Nenhuma conta Instagram profissional (Comercial ou Criador de Conteúdo) foi encontrada vinculada à sua conta do Facebook.', type: 'no_ig_account', icon: FaExclamationTriangle, colorClasses: 'text-yellow-700 bg-yellow-50 border-yellow-300' };
      if (errorMsg.includes('Permissão') || errorMsg.includes('ausente') || errorMsg.includes('(#10)') || errorMsg.includes('(#200)'))
        return { message: 'Permissão necessária não concedida pelo Facebook. Por favor, reconecte e certifique-se de aprovar todas as permissões solicitadas.', type: 'permission', icon: FaLock, colorClasses: 'text-yellow-700 bg-yellow-50 border-yellow-300' };
      if (errorMsg.includes('Token') || errorMsg.includes('expirado') || errorMsg.includes('inválido') || errorMsg.includes('access token'))
        return { message: 'Sua sessão com o Facebook/Instagram expirou ou é inválida. Por favor, conecte novamente.', type: 'token', icon: FaKey, colorClasses: 'text-orange-600 bg-orange-50 border-orange-300' };
      if (errorMsg.includes('Usuário não identificado')) // Este erro vem do seu backend /api/auth/iniciar-vinculacao-fb
        return { message: 'Você precisa estar logado na plataforma antes de conectar o Instagram.', type: 'local_linking', icon: FaExclamationCircle, colorClasses: 'text-red-600 bg-red-50 border-red-200' };
      
      // Erro genérico da sincronização ou conexão
      return { message: `Erro na conexão/sincronização: ${errorMsg}`, type: 'general_backend', icon: FaExclamationTriangle, colorClasses: 'text-red-600 bg-red-50 border-red-200' };
    }
    return null;
  }, [disconnectError, accountSelectionError, linkError, user?.igConnectionError, canAccessFeatures]);

  const handleInitiateFacebookLink = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!canAccessFeatures) {
      event.preventDefault();
      showToast("Conecte seu Instagram e automatize suas métricas com um plano premium.", 'info');
      onActionRedirect();
      return;
    }

    setIsLinking(true);
    setLinkError(null);
    setDisconnectError(null);
    setAccountSelectionError(null); 

    try {
      logger.info("Chamando /api/auth/iniciar-vinculacao-fb");
      const res = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Falha ao preparar vinculação (resposta não-JSON).' }));
        logger.error("Erro ao chamar /api/auth/iniciar-vinculacao-fb:", errData);
        throw new Error(errData.message || 'Falha ao preparar vinculação com Facebook.');
      }
      logger.info("/api/auth/iniciar-vinculacao-fb OK. Iniciando signIn('facebook').");
      signIn('facebook', { callbackUrl: '/dashboard/chat?instagramLinked=true' });
    } catch (e: any) {
      logger.error('Erro ao iniciar vinculação:', e);
      setLinkError(e.message || 'Erro inesperado ao tentar conectar com Facebook.');
      setIsLinking(false);
    }
  };

  const handleDisconnectInstagram = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!canAccessFeatures) { 
       event.preventDefault();
       showToast("Gerencie sua conexão com o Instagram ao assinar um plano.", 'info');
       onActionRedirect();
       return;
    }
    setIsDisconnecting(true);
    setDisconnectError(null);
    setLinkError(null); 
    setAccountSelectionError(null);
    try {
      logger.info("Chamando /api/instagram/disconnect");
      const res = await fetch('/api/instagram/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Falha ao desconectar (resposta não-JSON).' }));
        logger.error("Erro ao chamar /api/instagram/disconnect:", errData);
        throw new Error(errData.message || 'Falha ao desconectar Instagram.');
      }
      logger.info("/api/instagram/disconnect OK. Forçando atualização da sessão.");
      await update();
      setShowSuccessToastFromCard("Instagram desconectado com sucesso!");
    } catch (e: any) {
      logger.error('Erro ao desconectar:', e);
      setDisconnectError(e.message || 'Erro ao tentar desconectar Instagram.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleConnectSelectedAccount = async (igAccountId: string) => {
    if (!igAccountId) {
        logger.error("handleConnectSelectedAccount chamado sem igAccountId.");
        setAccountSelectionError("Nenhum ID de conta do Instagram foi fornecido.");
        return;
    }
    
    setIsConnectingSelectedAccount(true);
    setAccountSelectionError(null);

    logger.info(`Tentando conectar conta IG selecionada: ${igAccountId} via API.`);

    try {
      const response = await fetch('/api/instagram/connect-selected-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagramAccountId: igAccountId }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        logger.info("Conta IG conectada com sucesso via API. Atualizando sessão para refletir o novo estado...");
        await update();
        setShowAccountSelectorModal(false);
        showToast("Conta Instagram conectada com sucesso!", "success");
      } else {
        logger.error("Erro ao conectar conta IG via API:", result);
        setAccountSelectionError(result.error || result.message || 'Falha ao conectar a conta do Instagram selecionada.');
      }
    } catch (error: any) {
      logger.error("Erro de rede ou exceção ao conectar conta IG:", error);
      setAccountSelectionError(`Erro de comunicação ao conectar: ${error.message || 'Erro desconhecido.'}`);
    } finally {
      setIsConnectingSelectedAccount(false);
    }
  };
  
  const lastSyncAttemptDate = user?.lastInstagramSyncAttempt ? new Date(user.lastInstagramSyncAttempt) : null;
  const formattedLastSyncAttempt = lastSyncAttemptDate 
    ? format(lastSyncAttemptDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : 'N/A';

  let mainButtonText = "Conectar com Facebook";
  let mainButtonIcon = <FaFacebook className="w-5 h-5" />;
  let mainButtonStyles = "bg-blue-600 hover:bg-blue-700 text-white";
  let mainButtonDisabled = !canAccessFeatures || isLinking || isConnectingSelectedAccount || (isLoadingSession && !user);


  if (canAccessFeatures && (isLinking || isConnectingSelectedAccount)) {
    mainButtonText = isLinking ? "Iniciando Facebook..." : "Conectando Instagram...";
    mainButtonIcon = <FaSpinner className="animate-spin w-5 h-5" />;
  } else if (canAccessFeatures && currentDisplayError && currentDisplayError.type !== 'sync_failed' && currentDisplayError.type !== 'no_ig_account') {
    mainButtonText = "Tentar Novamente com Facebook";
    mainButtonStyles = "bg-yellow-500 hover:bg-yellow-600 text-white";
  }


  const renderAccountSelectorModal = () => {
    if (!showAccountSelectorModal || !user?.availableIgAccounts || user.availableIgAccounts.length === 0) {
      return null;
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
           onClick={() => { if(!isConnectingSelectedAccount) { setShowAccountSelectorModal(false); setAccountSelectionError(null); } }}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg"
          onClick={(e) => e.stopPropagation()} 
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Selecione sua Conta do Instagram</h3>
            <button 
                onClick={() => { setShowAccountSelectorModal(false); setAccountSelectionError(null); }} 
                disabled={isConnectingSelectedAccount}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Fechar modal"
            >
                <FaTimes className="w-6 h-6"/>
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-2">Encontramos as seguintes contas profissionais (Comercial ou Criador de Conteúdo) vinculadas ao seu Facebook.</p>
          <p className="text-xs text-gray-500 mb-5">Escolha qual você deseja usar com a Data2Content:</p>
          
          {isConnectingSelectedAccount && (
            <div className="text-center py-6">
              <FaSpinner className="animate-spin mx-auto text-brand-pink h-10 w-10" />
              <p className="text-md text-gray-700 mt-3 font-medium">Conectando conta selecionada...</p>
            </div>
          )}

          {!isConnectingSelectedAccount && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {(user.availableIgAccounts || []).map((account) => (
                <motion.button
                  key={account.igAccountId}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleConnectSelectedAccount(account.igAccountId)}
                  className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-pink shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    {account.profile_picture_url ? (
                        <img src={account.profile_picture_url} alt={`Foto de ${account.username || account.pageName}`} className="w-8 h-8 rounded-full flex-shrink-0 object-cover" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center text-white flex-shrink-0">
                            <FaInstagram className="w-4 h-4"/>
                        </div>
                    )}
                    <div>
                        <span className="font-semibold text-gray-800 text-sm">{account.username || account.pageName || `Conta Instagram`}</span>
                        <span className="text-xs text-gray-500 block">
                           {account.username ? `@${account.username}` : (account.pageName ? `Página: ${account.pageName}` : `ID: ${account.igAccountId}`)}
                        </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
          {accountSelectionError && !isConnectingSelectedAccount && (
            <p className="text-xs text-red-600 mt-4 text-center py-2 bg-red-50 rounded-md border border-red-200">{accountSelectionError}</p>
          )}
        </motion.div>
      </div>
    );
  };

  if (isLoadingSession && !session) {
    return (
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Automação de Métricas</h2>
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg text-center text-gray-500 flex items-center justify-center min-h-[150px]">
          <FaSpinner className="animate-spin w-6 h-6 mr-3" /> Carregando dados da conexão...
        </div>
      </motion.section>
    );
  }

  return (
    <>
      {renderAccountSelectorModal()}
      <motion.section 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5, delay: 0.2 }}
      >
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
                    ? `Conectado como: @${user?.instagramUsername || user?.instagramAccountId || 'Conta Vinculada'}`
                    : 'Conecte sua conta profissional do Instagram.'}
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
              {isEffectivelyInstagramConnected ? (
                <div className="flex flex-col sm:items-end items-center gap-2">
                  <motion.span 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-1.5 text-sm text-green-700 bg-green-100 px-3 py-1.5 rounded-full border border-green-300 font-medium"
                    aria-live="polite"
                  >
                    <FaCheckCircle /> Conectado
                  </motion.span>
                  <button
                    onClick={handleDisconnectInstagram}
                    disabled={isDisconnecting}
                    className="px-4 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-md hover:bg-red-200 border border-red-300 flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-wait transition-colors duration-150"
                    aria-label="Desconectar conta do Instagram"
                  >
                    {isDisconnecting ? <FaSpinner className="animate-spin w-3 h-3" /> : <FaUnlink className="w-3 h-3" />}
                    {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                  <button
                    onClick={handleInitiateFacebookLink}
                    disabled={mainButtonDisabled}
                    className={`w-full sm:w-auto px-6 py-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2.5 
                                transition-all duration-150 ease-in-out transform hover:scale-105 shadow-md hover:shadow-lg
                                ${mainButtonDisabled ? 'opacity-70 cursor-wait' : ''}
                                ${mainButtonStyles} 
                              `}
                    aria-label="Conectar conta do Instagram com Facebook"
                  >
                    {mainButtonIcon}
                    {mainButtonText}
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <AnimatePresence>
            {canAccessFeatures && currentDisplayError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`mt-4 p-3 border rounded-md text-xs flex items-start gap-2 ${currentDisplayError.colorClasses}`}
                role="alert"
              >
                <currentDisplayError.icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{currentDisplayError.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {isEffectivelyInstagramConnected && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="mt-4 text-xs text-gray-600 border-t pt-3"
            >
              <div className="flex items-center gap-2">
                <FaInfoCircle className="text-blue-500" aria-hidden="true"/>
                <span>
                  Última tentativa de sincronização: {formattedLastSyncAttempt}.
                </span>
                {user?.lastInstagramSyncSuccess === true && <FaCheckCircle className="text-green-500" title="Sucesso na sincronização"/>}
                {user?.lastInstagramSyncSuccess === false && <FaExclamationCircle className="text-red-500" title="Falha na sincronização"/>}
                {user?.lastInstagramSyncSuccess === null && user?.lastInstagramSyncAttempt && <FaClock className="text-gray-500" title="Status da sincronização desconhecido ou pendente"/>}
              </div>
              {user?.lastInstagramSyncSuccess === false && !currentDisplayError && ( 
                <p className="mt-1 text-red-600">Houve uma falha na última sincronização. Se o problema persistir, tente desconectar e reconectar sua conta.</p>
              )}
            </motion.div>
          )}

          {/* --- TEXTO ATUALIZADO --- */}
          <p className={`text-xs text-gray-500 mt-4 ${isEffectivelyInstagramConnected ? '' : 'border-t pt-3'}`}>
            {isEffectivelyInstagramConnected
            ? 'Piloto automático ativado! Seus novos posts serão cadastrados e analisados pelo Mobi sem esforço.'
            : 'Conecte seu Instagram e ative o piloto automático! O Mobi passa a cadastrar e analisar seus posts para você, sem esforço.'
          }
          </p>
        </div>
      </motion.section>
    </>
  );
};

export default InstagramConnectCard;

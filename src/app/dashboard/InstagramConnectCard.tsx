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
  // pendingInstagramConnection?: boolean; // REMOVIDO - Não mais usado
  availableIgAccounts?: AvailableInstagramAccount[] | null;
  igConnectionError?: string | null; // Adicionado null para permitir limpar o erro
  instagramAccountId?: string | null;
  instagramUsername?: string | null;
};

const InstagramConnectCard: React.FC<InstagramConnectCardProps> = () => {
  // Hooks de sessão e estado local
  const { data: session, status, update } = useSession(); // 'update' força a re-busca da sessão
  const [isLinking, setIsLinking] = useState(false); // Estado de carregamento para iniciar conexão FB
  const [linkError, setLinkError] = useState<string | null>(null); // Erro ao iniciar conexão FB
  const [isDisconnecting, setIsDisconnecting] = useState(false); // Estado de carregamento para desconectar
  const [disconnectError, setDisconnectError] = useState<string | null>(null); // Erro ao desconectar
  // const [selectedIgAccountId, setSelectedIgAccountId] = useState<string>(''); // REMOVIDO - Seleção não é mais finalizada aqui
  // const [isFinalizing, setIsFinalizing] = useState(false); // REMOVIDO
  // const [finalizeError, setFinalizeError] = useState<string | null>(null); // REMOVIDO
  // const [showSelectionFromCookie, setShowSelectionFromCookie] = useState(false); // REMOVIDO - Não usa mais cookie

  // REMOVIDO - useEffect que lia o cookie 'ig-connect-status'

  // REMOVIDO - useEffect que definia a seleção padrão baseado no cookie/pending

  // Variáveis derivadas do estado da sessão
  const isLoadingSession = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  const user = session?.user as SessionUserWithInstagram | undefined;
  const isInstagramConnected = user?.instagramConnected ?? false;

  // Lógica para exibir UI de seleção (dropdown) - Simplificada
  // Mostra se não está conectado E existem contas disponíveis na sessão (vindo do callback jwt)
  // Isso cobre o cenário de fallback onde múltiplas contas podem ser retornadas.
  // No fluxo ideal (config_id + seleção no popup FB), availableIgAccounts pode nem ser populado,
  // ou isInstagramConnected já virá true após o callback.
  const availableAccounts: AvailableInstagramAccount[] = (!isInstagramConnected && user?.availableIgAccounts) ? user.availableIgAccounts : [];
  const showSelectionUI = availableAccounts.length > 0;

  // Função para obter a mensagem de erro a ser exibida
  const getDisplayError = (): string | null => {
    // Prioriza erros de desconexão ou erro vindo da sessão (callback jwt)
    if (disconnectError) return `Erro ao desconectar: ${disconnectError}`;
    if (user?.igConnectionError) {
      // Traduz mensagens de erro comuns
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
    // Erro ao iniciar o link
    if (linkError) return `Erro ao iniciar: ${linkError}`;
    return null; // Sem erro
  };
  const displayError = getDisplayError();

  // Manipulador para iniciar o fluxo de vinculação/login com Facebook
  const handleInitiateFacebookLink = async () => {
    setIsLinking(true);
    setLinkError(null); // Limpa erros anteriores
    setDisconnectError(null);
    // user.igConnectionError = null; // Não podemos modificar a sessão diretamente

    try {
      // Chama a API interna para gerar o link token (necessário para vincular ao usuário Google)
      const res = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Falha ao preparar vinculação');
      }
      // Inicia o fluxo de login do NextAuth com o provedor 'facebook'
      // O callback jwt no backend cuidará de chamar fetchAvailableInstagramAccounts
      signIn('facebook', { callbackUrl: '/dashboard' });
      // Não precisamos mais setar estado pendente ou cookie
    } catch (e: any) {
      console.error('[InstagramConnectCard] Erro ao iniciar vinculação:', e);
      setLinkError(e.message || 'Erro inesperado');
      setIsLinking(false); // Reseta estado de carregamento em caso de erro
    }
    // setIsLinking(false) // Removido daqui, pois o signIn redireciona a página
  };

  // REMOVIDO - handleFinalizeConnection e a chamada à API /api/instagram/finalize-connection
  // A finalização agora deve ocorrer implicitamente no backend (callback jwt) ou via seleção no popup do FB.

  // Manipulador para desconectar a conta do Instagram
  const handleDisconnectInstagram = async () => {
    setIsDisconnecting(true);
    setDisconnectError(null); // Limpa erros anteriores
    setLinkError(null);
    // user.igConnectionError = null; // Não podemos modificar a sessão

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
      setIsDisconnecting(false); // Reseta estado de carregamento
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
                  ? `Conectado como: ${user?.instagramUsername ?? user?.instagramAccountId}` // Mostra username ou ID se conectado
                  : 'Conecte sua conta profissional do Instagram.'}
              </p>
            </div>
          </div>

          {/* Botões de Ação / Seleção */}
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
                {/* Exibe erro de desconexão */}
                {disconnectError && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><FaExclamationCircle /> {disconnectError}</p>}
              </div>
            ) : showSelectionUI ? (
              // --- Estado de Seleção (Fallback ou Pós-Login sem seleção no popup) ---
              <div className="flex flex-col items-center sm:items-end w-full sm:w-auto gap-2">
                <label htmlFor="igAccountSelect" className="text-sm font-medium text-gray-700">Conta(s) encontrada(s):</label>
                {/* Mostra a lista de contas encontradas. A seleção aqui pode não ter efeito prático */}
                {/* se a finalização não for mais feita pelo frontend. */}
                {/* Pode ser útil apenas para informação ou se uma API de seleção for reintroduzida. */}
                <select
                  id="igAccountSelect"
                  // value={selectedIgAccountId} // Estado removido
                  // onChange={e => setSelectedIgAccountId(e.target.value)} // Estado removido
                  disabled={availableAccounts.length === 0} // Desabilita se vazio
                  className="w-full sm:w-auto px-3 py-2 border rounded-md text-sm disabled:opacity-70 bg-white"
                >
                  {availableAccounts.map(acc => (
                    <option key={acc.igAccountId} value={acc.igAccountId}>
                      {acc.pageName} ({acc.igAccountId})
                    </option>
                  ))}
                </select>
                {/* REMOVIDO - Botão "Confirmar Conta" e sua lógica */}
                {/* <p className="text-xs text-gray-500 mt-1">Confirme a conta desejada ou refaça a conexão.</p> */}
                {/* Exibe erro vindo da sessão (jwt callback) */}
                {displayError && <p className="text-xs text-red-600 mt-1 flex items-center gap-1 max-w-xs"><FaExclamationCircle /> {displayError}</p>}
                {/* Adiciona botão para tentar novamente se houver erro */}
                {user?.igConnectionError && (
                   <button onClick={handleInitiateFacebookLink} disabled={isLinking} className="mt-2 w-full sm:w-auto px-4 py-1.5 bg-blue-100 text-blue-600 text-xs font-medium rounded hover:bg-blue-200 border border-blue-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait">
                     {isLinking ? <FaSpinner className="animate-spin w-3 h-3" /> : <FaFacebook className="w-3 h-3" />}
                     {isLinking ? 'Iniciando...' : 'Tentar Conectar Novamente'}
                   </button>
                )}
              </div>
            ) : (
              // --- Estado Desconectado (Inicial) ---
              <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                <button
                  onClick={handleInitiateFacebookLink}
                  disabled={isLinking}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white text-sm rounded-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                >
                  {isLinking ? <FaSpinner className="animate-spin w-4 h-4" /> : <FaFacebook className="w-4 h-4" />}
                  {isLinking ? 'Iniciando...' : 'Conectar com Facebook'}
                </button>
                {/* Exibe erro ao iniciar link ou erro geral da sessão */}
                {displayError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1 max-w-xs"><FaExclamationCircle /> {displayError}</p>}
              </div>
            )}
          </div>
        </div>
        {/* Texto de Ajuda Inferior */}
        <p className="text-xs text-gray-500 mt-4 border-t pt-3">
          {isInstagramConnected
            ? 'A coleta automática de métricas está ativa.'
            : showSelectionUI
            ? 'Uma ou mais contas foram encontradas. A conexão deve ser finalizada automaticamente. Se houver erro, tente reconectar.' // Mensagem ajustada
            : 'Clique em "Conectar com Facebook" para autorizar o acesso à sua conta profissional do Instagram.'}
        </p>
      </div>
    </motion.section>
  );
};

export default InstagramConnectCard;

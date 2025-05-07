"use client";

import React, { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { FaFacebook, FaInstagram, FaSpinner, FaUnlink, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import { motion } from 'framer-motion';
import type { AvailableInstagramAccount } from '@/app/lib/instagramService'; // Ensure the path is correct
import type { Session } from 'next-auth';

interface InstagramConnectCardProps {}

// Extended type for the session, including Instagram fields
type BaseUserType = NonNullable<Session['user']>;
type SessionUserWithInstagram = BaseUserType & {
  instagramConnected?: boolean;
  availableIgAccounts?: AvailableInstagramAccount[] | null;
  igConnectionError?: string | null;
  instagramAccountId?: string | null;
  instagramUsername?: string | null; // This is the username of the *connected* account
};

const InstagramConnectCard: React.FC<InstagramConnectCardProps> = () => {
  // Session and local state hooks
  const { data: session, status, update } = useSession();
  const [isLinking, setIsLinking] = useState(false); // Loading state for initiating FB connection
  const [linkError, setLinkError] = useState<string | null>(null); // Local error when initiating FB connection
  const [isDisconnecting, setIsDisconnecting] = useState(false); // Loading state for disconnecting
  const [disconnectError, setDisconnectError] = useState<string | null>(null); // Local error when disconnecting

  // Derived variables from session state
  const isLoadingSession = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  const user = session?.user as SessionUserWithInstagram | undefined;
  const isInstagramConnected = user?.instagramConnected ?? false;

  // Logic to display available accounts (informational)
  // This list comes from the backend if multiple accounts were found during initial Facebook OAuth
  const informationalAvailableAccounts: AvailableInstagramAccount[] =
    (!isInstagramConnected && user?.availableIgAccounts && user.availableIgAccounts.length > 0)
      ? user.availableIgAccounts
      : [];
  const showInformationalAccountList = informationalAvailableAccounts.length > 0;

  // Function to get the error message to be displayed
  const getDisplayError = (): string | null => {
    // Prioritize local errors (disconnect, link) then session errors (backend)
    if (disconnectError) return `Erro ao desconectar: ${disconnectError}`;
    if (linkError) return `Erro ao iniciar: ${linkError}`; // Local error on button click
    if (user?.igConnectionError) {
      // Translate common error messages from the backend
      if (user.igConnectionError.includes('Nenhuma conta IG Business/Creator vinculada encontrada'))
        return 'Nenhuma conta Instagram profissional encontrada ou selecionada.';
      if (user.igConnectionError.includes('Permissão') || user.igConnectionError.includes('ausente'))
        return 'Permissão necessária não concedida. Refaça a conexão.';
      if (user.igConnectionError.includes('Token') || user.igConnectionError.includes('expirado'))
        return 'Sessão expirada ou inválida. Conecte novamente.';
      if (user.igConnectionError.includes('Usuário não identificado'))
        return 'Faça login com Google antes de conectar o Instagram.';
      // Other errors from the backend
      return `Erro de conexão: ${user.igConnectionError}`;
    }
    return null; // No error
  };
  const displayError = getDisplayError();

  // Handler to initiate the Facebook linking/login flow
  const handleInitiateFacebookLink = async () => {
    setIsLinking(true);
    setLinkError(null);
    setDisconnectError(null);
    // Clear session errors BEFORE initiating signIn so UI reflects the attempt
    if (user?.igConnectionError || user?.availableIgAccounts) {
        try {
            await update({ // Optimistically update client session and trigger refetch
                ...session,
                user: {
                    ...user,
                    igConnectionError: undefined,
                    availableIgAccounts: undefined
                }
            });
        } catch (updateError) {
            console.error("[InstagramConnectCard] Falha ao limpar erros da sessão antes de conectar:", updateError);
        }
    }

    try {
      // Call the internal API to generate the link token (if needed for linking)
      const res = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Falha ao preparar vinculação.' }));
        throw new Error(err.message || 'Falha ao preparar vinculação');
      }
      // Start NextAuth login flow with 'facebook' provider
      // The backend now automatically connects the found account.
      signIn('facebook', { callbackUrl: '/dashboard' });
    } catch (e: any) {
      console.error('[InstagramConnectCard] Erro ao iniciar vinculação:', e);
      setLinkError(e.message || 'Erro inesperado');
      setIsLinking(false); // Reset loading state only on error *before* signIn
    }
    // Do not reset isLinking here as signIn redirects
  };

  // Handler to disconnect the Instagram account
  const handleDisconnectInstagram = async () => {
    setIsDisconnecting(true);
    setDisconnectError(null);
    setLinkError(null);

    try {
      // Call the disconnect API on the backend
      const res = await fetch('/api/instagram/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Falha ao desconectar.' }));
        throw new Error(err.message || 'Falha ao desconectar');
      }
      // Force session update to reflect disconnected state
      await update();
    } catch (e: any) {
      console.error('[InstagramConnectCard] Erro ao desconectar:', e);
      setDisconnectError(e.message || 'Erro ao desconectar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Do not render anything if session is loading or if not authenticated
  if (isLoadingSession || !isAuthenticated) return null;

  // Main component rendering
  return (
    <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Automação de Métricas</h2>
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Account Information */}
          <div className="flex items-center gap-3">
            <FaInstagram className="w-8 h-8 text-pink-600" />
            <div>
              <h3 className="font-semibold text-lg text-gray-800">Instagram Insights</h3>
              <p className="text-sm text-gray-500 mt-1">
                {isInstagramConnected
                  ? `Conectado como: ${user?.instagramUsername || user?.instagramAccountId || 'Conta Desconhecida'}` // Show username or ID of connected account
                  : 'Conecte sua conta profissional do Instagram.'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
            {isInstagramConnected ? (
              // --- Connected State ---
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
                {/* Display local disconnect error */}
                {disconnectError && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><FaExclamationCircle /> {disconnectError}</p>}
              </div>
            ) : (
              // --- Disconnected State ---
              <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                {/* Main button: Connect or Try Again if there's an error */}
                <button
                  onClick={handleInitiateFacebookLink}
                  disabled={isLinking}
                  className={`w-full sm:w-auto px-5 py-2.5 text-sm rounded-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait ${
                    displayError ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white' // Different style if it's a retry
                  }`}
                >
                  {isLinking ? <FaSpinner className="animate-spin w-4 h-4" /> : <FaFacebook className="w-4 h-4" />}
                  {isLinking ? 'Iniciando...' : (displayError ? 'Tentar Conectar Novamente' : 'Conectar com Facebook')}
                </button>
                {/* Display error (local or session) - do not show if informational account list is already visible AND there's no error */}
                {displayError && !showInformationalAccountList && <p className="text-xs text-red-600 mt-2 flex items-center gap-1 max-w-xs text-left sm:text-right"><FaExclamationCircle /> {displayError}</p>}
              </div>
            )}
          </div>
        </div>
        {/* Informational Section for Detected Accounts (when not connected yet and no error on main button) */}
        {showInformationalAccountList && !displayError && (
          <div className="mt-4 p-3 border border-sky-200 bg-sky-50 rounded-md">
            <p className="text-sm text-sky-700 mb-2 font-medium">
              Contas do Instagram detectadas via Facebook:
            </p>
            <ul className="list-disc list-inside pl-2 text-sm text-gray-600">
              {informationalAvailableAccounts.map(acc => (
                <li key={acc.igAccountId}>
                  {/* UPDATED: Display pageName and igAccountId */}
                  {acc.pageName ? `${acc.pageName} (ID: ${acc.igAccountId})` : `ID da Conta: ${acc.igAccountId}`}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 mt-2">
              A primeira conta da lista (ID: {informationalAvailableAccounts[0]?.igAccountId}) deve ser conectada automaticamente.
              Se esta não for a conta desejada ou se a conexão falhar, verifique as permissões no Facebook ou tente reconectar.
            </p>
          </div>
        )}
        {/* Display session error even if informational list is visible (if error is relevant alongside the list) */}
         {showInformationalAccountList && displayError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1 max-w-xs text-left"><FaExclamationCircle /> {displayError}</p>}


        <p className="text-xs text-gray-500 mt-4 border-t pt-3">
          {isInstagramConnected
            ? 'A coleta automática de métricas está ativa.'
            : displayError // If there's an error
            ? 'Ocorreu um erro durante a conexão. Verifique as permissões no Facebook ou tente novamente.' // Generic error message
            : showInformationalAccountList // No error, but list is shown
            ? 'O processo de conexão automática foi iniciado. Verifique o status em instantes.'
            // No error, no list shown (initial state)
            : 'Clique em "Conectar com Facebook" para autorizar o acesso à sua conta profissional do Instagram. A conexão será automática.'}
        </p>
      </div>
    </motion.section>
  );
};

export default InstagramConnectCard;

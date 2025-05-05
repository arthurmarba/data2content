"use client";

import React, { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { FaFacebook, FaInstagram, FaSpinner, FaUnlink, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import { motion } from 'framer-motion';
import type { AvailableInstagramAccount } from '@/app/lib/instagramService';
import type { Session } from 'next-auth';

interface InstagramConnectCardProps {}

type BaseUserType = NonNullable<Session['user']>;
type SessionUserWithInstagram = BaseUserType & {
  instagramConnected?: boolean;
  pendingInstagramConnection?: boolean;
  availableIgAccounts?: AvailableInstagramAccount[] | null;
  igConnectionError?: string;
  instagramAccountId?: string;
  instagramUsername?: string;
};

const InstagramConnectCard: React.FC<InstagramConnectCardProps> = () => {
  const { data: session, status, update } = useSession();
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [selectedIgAccountId, setSelectedIgAccountId] = useState<string>('');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [showSelectionFromCookie, setShowSelectionFromCookie] = useState(false);

  // Lê cookie e exibe seleção uma vez
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (status !== 'authenticated' || showSelectionFromCookie) return;

    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('ig-connect-status='))
      ?.split('=')[1];

    if (cookieValue === 'pending') {
      console.log("[InstagramConnectCard] Cookie 'ig-connect-status=pending' encontrado.");
      setShowSelectionFromCookie(true);
      document.cookie = 'ig-connect-status=; Path=/; Max-Age=0; SameSite=Lax';
      console.log("[InstagramConnectCard] Cookie deletado.");
    }
  }, [status, showSelectionFromCookie]);

  // Define seleção padrão ou limpa ao conectar/desconectar
  useEffect(() => {
    if (status !== 'authenticated') {
      setSelectedIgAccountId('');
      setShowSelectionFromCookie(false);
      return;
    }
    const user = session?.user as SessionUserWithInstagram | undefined;
    if (showSelectionFromCookie || user?.pendingInstagramConnection) {
      const accounts = user?.availableIgAccounts ?? [];
      if (accounts.length > 0 && !selectedIgAccountId) {
        const first = accounts[0];
        if (first) {
          setSelectedIgAccountId(first.igAccountId);
        }
      }
    } else if (user?.instagramConnected && selectedIgAccountId) {
      setSelectedIgAccountId('');
      setShowSelectionFromCookie(false);
    }
  }, [status, session, showSelectionFromCookie, selectedIgAccountId]);

  const isLoadingSession = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  const user = session?.user as SessionUserWithInstagram | undefined;
  const isInstagramConnected = user?.instagramConnected ?? false;
  const pendingSession = user?.pendingInstagramConnection ?? false;

  const showSelectionUI = !isInstagramConnected && (showSelectionFromCookie || pendingSession);
  const availableAccounts: AvailableInstagramAccount[] = showSelectionUI ? user?.availableIgAccounts ?? [] : [];

  const getDisplayError = (): string | null => {
    if (finalizeError) return `Erro ao confirmar: ${finalizeError}`;
    if (disconnectError) return `Erro ao desconectar: ${disconnectError}`;
    if (user?.igConnectionError) {
      if (user.igConnectionError.includes('Nenhuma conta Instagram Business/Creator encontrada'))
        return 'Nenhuma conta Instagram profissional vinculada às suas Páginas.';
      if (user.igConnectionError.includes('Permissão `pages_show_list` ausente'))
        return 'Permissão para listar Páginas não concedida. Refaça a conexão.';
      if (user.igConnectionError.includes('Token de acesso inválido'))
        return 'Token expirado ou inválido. Conecte novamente.';
      return `Erro de conexão: ${user.igConnectionError}`;
    }
    if (linkError) return `Erro ao iniciar: ${linkError}`;
    return null;
  };
  const displayError = getDisplayError();

  const handleInitiateFacebookLink = async () => {
    setIsLinking(true);
    setLinkError(null);
    setDisconnectError(null);
    setFinalizeError(null);
    try {
      const res = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Falha ao preparar vinculação');
      }
      signIn('facebook', { callbackUrl: '/dashboard' });
    } catch (e: any) {
      console.error('[InstagramConnectCard] Iniciar vinculação:', e);
      setLinkError(e.message || 'Erro inesperado');
      setIsLinking(false);
    }
  };

  const handleFinalizeConnection = async () => {
    console.log('[handleFinalizeConnection] Início');
    if (!selectedIgAccountId) {
      setFinalizeError('Selecione uma conta do Instagram.');
      return;
    }
    setIsFinalizing(true);
    setFinalizeError(null);
    try {
      const res = await fetch('/api/instagram/finalize-connection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedIgAccountId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Falha ao finalizar conexão');
      }
      document.cookie = 'ig-connect-status=; Path=/; Max-Age=0; SameSite=Lax';
      setShowSelectionFromCookie(false);
      await update();
      setSelectedIgAccountId('');
    } catch (e: any) {
      console.error('[InstagramConnectCard] Finalizar conexão:', e);
      setFinalizeError(e.message || 'Erro ao finalizar');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    setIsDisconnecting(true);
    setDisconnectError(null);
    setLinkError(null);
    setFinalizeError(null);
    try {
      const res = await fetch('/api/instagram/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Falha ao desconectar');
      }
      document.cookie = 'ig-connect-status=; Path=/; Max-Age=0; SameSite=Lax';
      setShowSelectionFromCookie(false);
      await update();
    } catch (e: any) {
      console.error('[InstagramConnectCard] Desconectar:', e);
      setDisconnectError(e.message || 'Erro ao desconectar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoadingSession || !isAuthenticated) return null;

  return (
    <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Automação de Métricas</h2>
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FaInstagram className="w-8 h-8 text-pink-600" />
            <div>
              <h3 className="font-semibold text-lg text-gray-800">Instagram Insights</h3>
              <p className="text-sm text-gray-500 mt-1">
                {isInstagramConnected ? `Conectado como: ${user?.instagramUsername ?? user?.instagramAccountId}` : 'Conecte sua conta profissional do Instagram.'}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
            {isInstagramConnected ? (
              <div className="flex flex-col sm:items-end items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                  <FaCheckCircle /> Conectado
                </span>
                <button onClick={handleDisconnectInstagram} disabled={isDisconnecting} className="px-3 py-1 bg-red-100 text-red-600 text-xs font-medium rounded hover:bg-red-200 border border-red-200 flex items-center justify-center gap-1 disabled:opacity-70 disabled:cursor-wait">
                  {isDisconnecting ? <FaSpinner className="animate-spin w-3 h-3" /> : <FaUnlink className="w-3 h-3" />} {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                </button>
                {disconnectError && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><FaExclamationCircle /> {disconnectError}</p>}
              </div>
            ) : showSelectionUI ? (
              <div className="flex flex-col items-center sm:items-end w-full sm:w-auto gap-2">
                <label htmlFor="igAccountSelect" className="text-sm font-medium text-gray-700">Selecione a conta Instagram:</label>
                <select id="igAccountSelect" value={selectedIgAccountId} onChange={e => { setSelectedIgAccountId(e.target.value); setFinalizeError(null); }} disabled={isFinalizing || availableAccounts.length === 0} className="w-full sm:w-auto px-3 py-2 border rounded-md text-sm disabled:opacity-70 bg-white">
                  {availableAccounts.length === 0 && <option value="">{user?.igConnectionError ? 'Erro ao buscar contas' : 'Carregando contas...'}</option>}
                  {availableAccounts.map(acc => <option key={acc.igAccountId} value={acc.igAccountId}>{acc.pageName} ({acc.igAccountId})</option>)}
                </select>
                <button onClick={handleFinalizeConnection} disabled={isFinalizing || !selectedIgAccountId} className="w-full sm:w-auto px-5 py-2.5 bg-green-600 text-white text-sm rounded-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait">
                  {isFinalizing ? <FaSpinner className="animate-spin w-4 h-4" /> : <FaCheckCircle className="w-4 h-4" />} {isFinalizing ? 'Confirmando...' : 'Confirmar Conta'}
                </button>
                {displayError && <p className="text-xs text-red-600 mt-1 flex items-center gap-1 max-w-xs"><FaExclamationCircle /> {displayError}</p>}
              </div>
            ) : (
              <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                <button onClick={handleInitiateFacebookLink} disabled={isLinking} className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white text-sm rounded-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait">
                  {isLinking ? <FaSpinner className="animate-spin w-4 h-4" /> : <FaFacebook className="w-4 h-4" />} {isLinking ? 'Iniciando...' : 'Conectar com Facebook'}
                </button>
                {displayError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1 max-w-xs"><FaExclamationCircle /> {displayError}</p>}
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4 border-t pt-3">
          {isInstagramConnected
            ? 'A coleta automática de métricas está ativa.'
            : showSelectionUI
            ? 'Selecione a conta Instagram correta e clique em "Confirmar Conta".'
            : 'Clique em "Conectar com Facebook" para autorizar o acesso.'}
        </p>
      </div>
    </motion.section>
  );
};

export default InstagramConnectCard;

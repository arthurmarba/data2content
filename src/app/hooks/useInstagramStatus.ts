'use client';

import { useCallback, useEffect, useState } from 'react';

type RawInstagramStatus = {
  ok: boolean;
  isConnected: boolean;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastSyncAttempt: string | null;
  lastSyncSuccess: boolean | null;
  reconnectNotifiedAt: string | null;
  disconnectCount: number;
  reconnectState: 'idle' | 'oauth_in_progress' | 'awaiting_account_selection' | 'finalizing' | 'connected' | 'failed' | null;
  username: string | null;
  profilePictureUrl: string | null;
  pageName: string | null;
};

export type InstagramStatus = {
  isConnected: boolean;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastSyncAttempt: Date | null;
  lastSyncSuccess: boolean | null;
  reconnectNotifiedAt: Date | null;
  disconnectCount: number;
  reconnectState: 'idle' | 'oauth_in_progress' | 'awaiting_account_selection' | 'finalizing' | 'connected' | 'failed';
  username: string | null;
  profilePictureUrl: string | null;
  pageName: string | null;
};

const parseStatus = (raw: RawInstagramStatus): InstagramStatus => ({
  isConnected: raw.isConnected,
  lastErrorCode: raw.lastErrorCode,
  lastErrorMessage: raw.lastErrorMessage,
  lastSyncAttempt: raw.lastSyncAttempt ? new Date(raw.lastSyncAttempt) : null,
  lastSyncSuccess: raw.lastSyncSuccess,
  reconnectNotifiedAt: raw.reconnectNotifiedAt ? new Date(raw.reconnectNotifiedAt) : null,
  disconnectCount: raw.disconnectCount ?? 0,
  reconnectState: raw.reconnectState ?? 'idle',
  username: raw.username ?? null,
  profilePictureUrl: raw.profilePictureUrl ?? null,
  pageName: raw.pageName ?? null,
});

export function useInstagramStatus(auto = true) {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(auto);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/instagram/status', { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Falha ao verificar status do Instagram');
      }
      const data: RawInstagramStatus = await res.json();
      setStatus(parseStatus(data));
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado');
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    fetchStatus();
  }, [auto, fetchStatus]);

  return {
    status,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}

export default useInstagramStatus;

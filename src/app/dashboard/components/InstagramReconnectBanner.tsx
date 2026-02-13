'use client';

import Link from 'next/link';
import { FaExclamationTriangle } from 'react-icons/fa';
import useInstagramStatus from '@/app/hooks/useInstagramStatus';
import { useMemo } from 'react';
import { IG_RECONNECT_ACTIONABLE_CODES, normalizeInstagramReconnectErrorCode } from '@/app/lib/instagram/reconnectErrors';

export default function InstagramReconnectBanner() {
  const { status, isLoading, error } = useInstagramStatus(true);

  const shouldShow = useMemo(() => {
    if (isLoading || error || !status) return false;
    const code = normalizeInstagramReconnectErrorCode(status.lastErrorCode);
    if (!status.isConnected) return IG_RECONNECT_ACTIONABLE_CODES.has(code);
    return status.reconnectState !== 'connected' && status.reconnectState !== 'idle';
  }, [status, isLoading, error]);

  if (!shouldShow || !status) return null;

  const reason = status.lastErrorMessage || 'Perdemos o acesso às permissões do Instagram.';

  return (
    <div className="mb-4 w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2">
          <FaExclamationTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Precisamos que você reconecte seu Instagram</p>
            <p className="text-amber-800">{reason}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Link
            href="/dashboard/instagram/connect"
            className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            Reconectar agora
          </Link>
          <a
            href="mailto:suporte@data2content.ai"
            className="text-sm font-medium text-amber-900 underline-offset-4 hover:underline"
          >
            Falar com suporte
          </a>
        </div>
      </div>
    </div>
  );
}

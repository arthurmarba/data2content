// src/app/components/ClientHooksWrapper.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const AGENCY_INVITE_KEY = 'agencyInviteCode';
const AGENCY_INVITE_EXPIRATION_DAYS = 7;

export default function ClientHooksWrapper() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // A lógica do typeof window !== 'undefined' garante execução somente no cliente
    if (typeof window !== 'undefined') {
      const invite = searchParams.get('codigo_agencia');
      if (invite && invite.trim() !== '') {
        const expiresAt = Date.now() + AGENCY_INVITE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
        const data = { code: invite.trim(), expiresAt };
        try {
          localStorage.setItem(AGENCY_INVITE_KEY, JSON.stringify(data));
          console.log('[ClientHooksWrapper] Código de agência salvo:', data);
        } catch (error) {
          console.error('[ClientHooksWrapper] Erro ao salvar código de agência no localStorage:', error);
        }
      }
    }
  }, [searchParams]);

  // Este componente não precisa renderizar nada visualmente,
  // ele apenas encapsula os hooks de cliente.
  return null;
}
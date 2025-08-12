// src/app/components/ClientHooksWrapper.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const AFFILIATE_REF_KEY = 'affiliateRefCode';
const AFFILIATE_REF_EXPIRATION_DAYS = 90;
const AGENCY_INVITE_KEY = 'agencyInviteCode';
const AGENCY_INVITE_EXPIRATION_DAYS = 7;

export default function ClientHooksWrapper() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // A lógica do typeof window !== 'undefined' garante execução somente no cliente
    if (typeof window !== 'undefined') {
      const refCode = searchParams.get('ref');
      if (refCode && refCode.trim() !== '') {
        const expiresAt = Date.now() + AFFILIATE_REF_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
        const refDataToStore = { code: refCode.trim(), expiresAt };
        try {
          localStorage.setItem(AFFILIATE_REF_KEY, JSON.stringify(refDataToStore));
        } catch (error) {
          console.error('[ClientHooksWrapper] Erro ao salvar código de referência no localStorage:', error);
        }

        try {
          const secure = window.location.protocol === 'https:';
          document.cookie = `d2c_ref=${encodeURIComponent(refCode.trim())}; path=/; max-age=${AFFILIATE_REF_EXPIRATION_DAYS * 24 * 60 * 60}; samesite=lax${secure ? '; secure' : ''}`;
        } catch (err) {
          console.error('[ClientHooksWrapper] Erro ao definir cookie de referência:', err);
        }
      }

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
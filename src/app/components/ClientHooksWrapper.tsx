// src/app/components/ClientHooksWrapper.tsx
"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const AFFILIATE_REF_KEY = 'affiliateRefCode';
const AFFILIATE_REF_EXPIRATION_DAYS = 30;

export default function ClientHooksWrapper() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // A lógica do window.undefined é para garantir que o código só rode no cliente
    if (typeof window !== 'undefined') {
      const refCode = searchParams.get('ref');
      if (refCode && refCode.trim() !== '') {
        const expiresAt = Date.now() + AFFILIATE_REF_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
        const refDataToStore = {
          code: refCode.trim(),
          expiresAt: expiresAt,
        };
        try {
          localStorage.setItem(AFFILIATE_REF_KEY, JSON.stringify(refDataToStore));
          console.log('[ClientHooksWrapper] Código de referência salvo:', refDataToStore);
        } catch (error) {
          console.error('[ClientHooksWrapper] Erro ao salvar código de referência no localStorage:', error);
        }
      }
    }
  }, [searchParams]);

  // Este componente não precisa renderizar nada visualmente,
  // ele apenas encapsula os hooks de cliente.
  return null;
}
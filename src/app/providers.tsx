// src/app/Providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { useEffect } from "react";
import Cookies from "js-cookie";
import { FeatureFlagProvider } from "@/app/context/FeatureFlagsContext";
import PaywallModalProvider from "@/app/components/PaywallModalProvider";

// --- INÍCIO DA CORREÇÃO ---
// A definição da interface que estava faltando foi adicionada de volta.
interface ProvidersProps {
  children: React.ReactNode;
  session: Session | null;
}
// --- FIM DA CORREÇÃO ---

const AFFILIATE_COOKIE_NAME = 'd2c_ref';

export function Providers({ children, session }: ProvidersProps) {
  useEffect(() => {
    // Este código roda uma vez quando a aplicação carrega no navegador.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('ref') || params.get('aff');

      // Se um código de afiliado estiver na URL...
      if (code) {
        try {
          // Salva no localStorage, que é o mais seguro contra redirecionamentos.
          localStorage.setItem(AFFILIATE_COOKIE_NAME, code);
          // Também define o cookie como fallback.
          Cookies.set(AFFILIATE_COOKIE_NAME, code, { expires: 90, path: '/', sameSite: 'lax' });
        } catch (e) {
          // Ignora erros se o localStorage/cookies estiverem desabilitados
          console.warn('Could not set affiliate cookie/storage:', e);
        }
      }
    }
  }, []); // O array vazio [] garante que rode apenas uma vez.

  return (
    <SessionProvider
      session={session}
      refetchInterval={5 * 60}
      refetchOnWindowFocus
      basePath="/api/auth"
    >
      <FeatureFlagProvider>
        {children}
        <PaywallModalProvider />
      </FeatureFlagProvider>
    </SessionProvider>
  );
}

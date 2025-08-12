// src/app/Providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth"; // Importe o tipo Session do NextAuth
import { useEffect } from "react";

interface ProvidersProps {
  children: React.ReactNode;
  session: Session | null; // ✅ Adicionada a prop session
}

export function Providers({ children, session }: ProvidersProps) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('ref') || params.get('aff');
      if (code) {
        const maxAge = 60 * 60 * 24 * 90; // 90 days
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `d2c_ref=${code}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
        try {
          localStorage.setItem('d2c_ref', code);
        } catch {
          // ignore if localStorage is unavailable
        }
      }
    }
  }, []);

  return (
    <SessionProvider
      session={session}
      refetchInterval={5 * 60}
      refetchOnWindowFocus
      basePath="/api/auth"
    >
      {children}
    </SessionProvider>
  );
}
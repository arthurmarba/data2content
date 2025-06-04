// src/app/Providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth"; // Importe o tipo Session do NextAuth

interface ProvidersProps {
  children: React.ReactNode;
  session: Session | null; // ✅ Adicionada a prop session
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider
      session={session} // ✅ Passa a session recebida para o SessionProvider
      // Revalida a sessão a cada 5 minutos (300s)
      refetchInterval={5 * 60}
      // Revalida a sessão ao focar a janela
      refetchOnWindowFocus
      // É uma boa prática definir o basePath se suas rotas de API do NextAuth
      // estão no local padrão /api/auth (o que parece ser o seu caso)
      basePath="/api/auth"
    >
      {children}
    </SessionProvider>
  );
}
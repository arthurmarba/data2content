"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

interface ProvidersProps {
  children: React.ReactNode;
  session?: Session;
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider
      session={session}
      // Revalida a sessão a cada 5 minutos (300s)
      refetchInterval={5 * 60}
      // Revalida a sessão ao focar a janela
      refetchOnWindowFocus
    >
      {children}
    </SessionProvider>
  );
}

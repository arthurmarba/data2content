"use client";

import { SessionProvider } from "next-auth/react";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider
      // Revalida a sessão a cada 5 minutos (300s)
      refetchInterval={5 * 60}
      // Revalida a sessão ao focar a janela
      refetchOnWindowFocus
    >
      {children}
    </SessionProvider>
  );
}

// src/app/layout.tsx
"use client";

import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import "./globals.css";

import Header from "./components/Header"; // Assumindo que este está em src/app/components/Header.tsx
import Footer from "./components/Footer"; // Assumindo que este está em src/app/components/Footer.tsx
import { Providers } from "./providers";
// Caminho do import corrigido para a localização correta:
import AuthRedirectHandler from "./components/auth/AuthRedirectHandler"; 

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: 'swap',
  variable: "--font-poppins",
});

const AFFILIATE_REF_KEY = 'affiliateRefCode';
const AFFILIATE_REF_EXPIRATION_DAYS = 30;

// export const metadata: Metadata = {
//   title: "Data2Content: Gestão de Carreira IA para Criadores",
//   description: "Impulsione sua carreira de criador com insights de IA via WhatsApp, gestão estratégica e oportunidades exclusivas. Vire afiliado e comece a ganhar.",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const searchParams = useSearchParams(); 

  const showHeader = pathname !== '/dashboard';

  useEffect(() => {
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
        } catch (error) {
          console.error('[Layout] Erro ao salvar código de referência no localStorage:', error);
        }
      }
    }
  }, [searchParams]);

  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full`}>
      <head>
      </head>
      <body
        className={`
          font-sans
          antialiased
          flex
          flex-col
          min-h-screen
          bg-brand-light
          text-brand-dark
        `}
      >
        <Providers>
          <AuthRedirectHandler>
            {showHeader && <Header />}
            <main className={`flex-grow ${showHeader ? 'pt-16 md:pt-20' : ''}`}>
              {children}
            </main>
            <Footer />
          </AuthRedirectHandler>
        </Providers>
      </body>
    </html>
  );
}
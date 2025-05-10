// src/app/layout.tsx (v1.1 - Header Condicional - MODIFICADO PARA CAPTURAR REF)
"use client";

import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { usePathname, useSearchParams } from 'next/navigation'; // <<< useSearchParams ADICIONADO >>>
import { useEffect } from 'react'; // <<< useEffect ADICIONADO >>>
import "./globals.css";

import Header from "./components/Header";
import Footer from "./components/Footer";
import { Providers } from "./providers";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: 'swap',
  variable: "--font-poppins",
});

// Chave para armazenar o código de afiliado no localStorage
const AFFILIATE_REF_KEY = 'affiliateRefCode';
// Duração em dias que o código de referência ficará armazenado
const AFFILIATE_REF_EXPIRATION_DAYS = 30;

// Metadata foi comentada no seu original, mantendo assim.
// Se precisar de metadata dinâmica ou específica por página,
// ela deve ser exportada de page.tsx ou de um layout Server Component pai.
// export const metadata: Metadata = {
// title: "Data2Content: Gestão de Carreira IA para Criadores",
// description: "Impulsione sua carreira de criador com insights de IA via WhatsApp, gestão estratégica e oportunidades exclusivas. Vire afiliado e comece a ganhar.",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const searchParams = useSearchParams(); // <<< Hook para ler query params >>>

  const showHeader = pathname !== '/dashboard';

  // --- INÍCIO: Lógica para capturar e armazenar código de afiliado ---
  useEffect(() => {
    // Garante que o código só rode no cliente, onde localStorage está disponível
    if (typeof window !== 'undefined') {
      const refCode = searchParams.get('ref');

      if (refCode && refCode.trim() !== '') {
        // console.log(`[Layout] Código de referência da URL detectado: ${refCode}`);
        const expiresAt = Date.now() + AFFILIATE_REF_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
        const refDataToStore = {
          code: refCode.trim(),
          expiresAt: expiresAt,
        };
        try {
          localStorage.setItem(AFFILIATE_REF_KEY, JSON.stringify(refDataToStore));
          // console.log(`[Layout] Código de referência salvo no localStorage:`, refDataToStore);
        } catch (error) {
          console.error('[Layout] Erro ao salvar código de referência no localStorage:', error);
        }
      }
    }
  }, [searchParams]); // O efeito será re-executado se os searchParams mudarem
  // --- FIM: Lógica para capturar e armazenar código de afiliado ---

  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full`}>
      <head>
         {/* Adicione links globais aqui se necessário (favicon, etc.) */}
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
          {showHeader && <Header />}
          <main className={`flex-grow ${showHeader ? 'pt-16 md:pt-20' : ''}`}>
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
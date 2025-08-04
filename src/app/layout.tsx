// src/app/layout.tsx

import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";

// Imports do NextAuth para buscar a sessão no servidor
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route"; // Ajuste o caminho se necessário

import Header from "./components/Header";
import Footer from "./components/Footer";
import { Providers } from "./providers";
import AuthRedirectHandler from "./components/auth/AuthRedirectHandler";
import ClientHooksWrapper from "./components/ClientHooksWrapper";
import MainContentWrapper from "./components/MainContentWrapper"; // ✅ IMPORTADO O NOVO COMPONENTE

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: 'swap',
  variable: "--font-poppins",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Data2Content: Gestão de Carreira IA para Criadores",
  description: "Impulsione sua carreira de criador com insights de IA via WhatsApp, gestão estratégica e oportunidades exclusivas. Vire afiliado e comece a ganhar.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Busca a sessão no servidor
  const session = await getServerSession(authOptions);
  const serializableSession = session ? JSON.parse(JSON.stringify(session)) : null;

  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full`}>
      <head>
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://www.google.com" />
        <link rel="preconnect" href="https://img.youtube.com" />
      </head>
      <body
        className={`
          ${inter.className}
          antialiased
          flex
          flex-col
          min-h-screen
          bg-brand-light
          text-brand-dark
        `}
      >
        <Providers session={serializableSession}>
          <ClientHooksWrapper />
          <AuthRedirectHandler>
            <Header />

            {/* ✅ O wrapper agora é usado aqui para aplicar o padding condicionalmente */}
            <MainContentWrapper>
              {children}
            </MainContentWrapper>
            
            <Footer />
          </AuthRedirectHandler>
        </Providers>
      </body>
    </html>
  );
}
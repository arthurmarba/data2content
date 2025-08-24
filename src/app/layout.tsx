// src/app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
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
import { ToastA11yProvider } from "@/app/components/ui/ToastA11yProvider";
import GoogleAnalytics from "./GoogleAnalytics";
import CookieConsent from "./components/CookieConsent";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://data2content.ai";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Data2Content: Gestão de Carreira IA para Criadores",
  description:
    "Impulsione sua carreira de criador com insights de IA via WhatsApp, gestão estratégica e oportunidades exclusivas. Vire afiliado e comece a ganhar.",
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
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://www.google.com" />
        <link rel="preconnect" href="https://img.youtube.com" />
        {GA_ID && (
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
        )}
        {GA_ID && (
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied' });
              gtag('config', '${GA_ID}');
            `}
          </Script>
        )}
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
        <ToastA11yProvider maxVisible={3}>
          <Providers session={serializableSession}>
            <GoogleAnalytics />
            <ClientHooksWrapper />
            <AuthRedirectHandler>
              <Header />

              {/* ✅ O wrapper agora é usado aqui para aplicar o padding condicionalmente */}
              <MainContentWrapper>{children}</MainContentWrapper>

              <Footer />
            </AuthRedirectHandler>
            <CookieConsent />
          </Providers>
        </ToastA11yProvider>
      </body>
    </html>
  );
}

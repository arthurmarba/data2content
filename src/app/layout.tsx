/* src/app/layout.tsx */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

// NextAuth (SSR)
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";

// Providers e utilidades globais (mantidos)
import { Providers } from "./providers";
import ClientHooksWrapper from "./components/ClientHooksWrapper";
import { ToastA11yProvider } from "@/app/components/ui/ToastA11yProvider";
import GoogleAnalytics from "./GoogleAnalytics";
import CookieConsent from "./components/CookieConsent";
// ⚠️ Header/Footer/MainContentWrapper/AuthRedirectHandler foram removidos daqui
// O dashboard controla seu próprio layout (incluindo Header/Sidebar).
// Páginas públicas podem ter seus próprios headers locais, se necessário.

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
}: Readonly<{ children: React.ReactNode }>) {
  // Sessão via SSR (mantido para quem precisar)
  const session = await getServerSession(authOptions);
  const serializableSession = session ? JSON.parse(JSON.stringify(session)) : null;

  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <head>
        {/* viewport-fit=cover para habilitar env(safe-area-inset-*) no iOS */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://www.google.com" />
        <link rel="preconnect" href="https://img.youtube.com" />

        {/* Variáveis CSS base (fallbacks). Reforçaremos via globals.css no mesmo Pacote A */}
        <style id="gemini-css-vars">{`
          :root {
            --header-h: 56px;               /* altura padrão do header (ajustada dinamicamente no Header do dashboard) */
            --sat: env(safe-area-inset-top);    /* safe-area top (iOS) */
            --sab: env(safe-area-inset-bottom); /* safe-area bottom (iOS) */
          }
        `}</style>

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
            {/* Root neutro: apenas renderiza as páginas.
               O /dashboard tem seu próprio layout (Header/Sidebar/overlay). */}
            {children}
            <CookieConsent />
          </Providers>
        </ToastA11yProvider>
      </body>
    </html>
  );
}

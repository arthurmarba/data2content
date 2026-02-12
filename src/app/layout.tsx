/* src/app/layout.tsx */

import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

// NextAuth (SSR)
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";

// Providers e utilidades globais (mantidos)
// ⚠️ Corrigido: providers -> Providers (case-sensitive)
import { Providers } from "./providers";
import ClientHooksWrapper from "./components/ClientHooksWrapper";
import { ToastA11yProvider } from "@/app/components/ui/ToastA11yProvider";
import GoogleAnalytics from "./GoogleAnalytics";
import CookieConsent from "./components/CookieConsent";

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
    <html lang="pt-BR" className="h-full">
      <head>
        {/* viewport-fit=cover para habilitar env(safe-area-inset-*) no iOS */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://www.google.com" />
        <link rel="preconnect" href="https://img.youtube.com" />

        {/* Variáveis CSS base (fallbacks). Reforçaremos via globals.css */}
        <style id="gemini-css-vars">{`
          :root {
            --header-h: 56px;
            --landing-header-h: 4.5rem;
            --sat: env(safe-area-inset-top);
            --sab: env(safe-area-inset-bottom);
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
          font-sans
          antialiased
          flex
          flex-col
          min-h-svh
          bg-brand-light
          text-brand-dark
        `}
      >
        <ToastA11yProvider maxVisible={3}>
          <Providers session={serializableSession}>
            <GoogleAnalytics />
            <ClientHooksWrapper />
            {children}
            <CookieConsent />
          </Providers>
        </ToastA11yProvider>
      </body>
    </html>
  );
}

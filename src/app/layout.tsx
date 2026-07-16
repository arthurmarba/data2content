/* src/app/layout.tsx */

import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import "@/design-system/tokens.css";

// NextAuth (SSR)
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";

// Providers e utilidades globais (mantidos)
// ⚠️ Corrigido: providers -> Providers (case-sensitive)
import { Providers } from "./providers";
import ClientHooksWrapper from "./components/ClientHooksWrapper";
import { ToastA11yProvider } from "@/app/components/ui/ToastA11yProvider";
import GoogleAnalytics from "./GoogleAnalytics";
import AnalyticsClickTracker from "./components/AnalyticsClickTracker";
import CookieConsent from "./components/CookieConsent";
import { Toaster as HotToaster } from "react-hot-toast";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://data2content.ai";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const serializedGaId = JSON.stringify(GA_ID);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Data2Content — Entenda o que seu conteúdo diz sobre você",
  description:
    "Descubra o que está funcionando, receba ideias prontas para postar e encontre criadores para crescer junto.",
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
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              window.gtag = function(){window.dataLayer.push(arguments);};

              var analyticsConsent = document.cookie
                .split('; ')
                .some(function(cookie) { return cookie === 'cookie_consent=granted'; })
                  ? 'granted'
                  : 'denied';

              window.gtag('consent', 'default', {
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                analytics_storage: analyticsConsent,
                wait_for_update: 500
              });
              window.gtag('js', new Date());
              window.gtag('config', ${serializedGaId}, { send_page_view: false });
              window.dispatchEvent(new Event('d2c-google-analytics-ready'));
            `}
          </Script>
        )}
        {GA_ID && (
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`}
            strategy="afterInteractive"
          />
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
            <Suspense fallback={null}>
              <GoogleAnalytics />
            </Suspense>
            <AnalyticsClickTracker />
            <ClientHooksWrapper />
            {children}
            <CookieConsent />
            <HotToaster
              position="top-right"
              toastOptions={{
                duration: 2800,
                style: {
                  borderRadius: "12px",
                  background: "#0f172a",
                  color: "#ffffff",
                },
              }}
            />
          </Providers>
        </ToastA11yProvider>
      </body>
    </html>
  );
}

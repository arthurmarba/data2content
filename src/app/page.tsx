// src/app/page.tsx (Corrigido)
// Este arquivo agora é um Server Component. Ele lida com metadados e renderiza o componente de cliente.

import LandingPageClient from "./LandingPageClient";
import {
  landingJsonLd,
  landingProductJsonLd,
  landingMetadata,
  landingFaqJsonLd,
  landingOrganizationJsonLd,
} from "@/seo/landing";

// Exportar metadados é permitido aqui porque não há "use client"
export const metadata = landingMetadata;

export default function HomePage() {
  return (
    <>
      {/* Os scripts LD+JSON são melhor renderizados no Server Component raiz */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            landingJsonLd,
            landingProductJsonLd,
            landingFaqJsonLd,
            landingOrganizationJsonLd,
          ]),
        }}
      />
      <LandingPageClient />
    </>
  );
}

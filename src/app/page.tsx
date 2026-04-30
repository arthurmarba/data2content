import { redirect } from "next/navigation";

import DashboardRootClient from "./DashboardRootClient";
import {
  landingJsonLd,
  landingProductJsonLd,
  landingMetadata,
  landingFaqJsonLd,
  landingOrganizationJsonLd,
} from "@/seo/landing";

// Exportar metadados é permitido aqui porque não há "use client"
export const metadata = landingMetadata;

type HomePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function HomePage({ searchParams = {} }: HomePageProps) {
  const query = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry));
  });

  if (query.get("board") === "post-creation") {
    query.delete("board");
    const queryString = query.toString();
    redirect(queryString ? `/calendar?${queryString}` : "/calendar");
  }

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
      <DashboardRootClient />
    </>
  );
}

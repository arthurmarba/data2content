import { redirect } from "next/navigation";

import { fetchCastingCreators } from "@/app/lib/landing/castingService";
import { fetchLandingProofMetrics } from "@/app/lib/landing/landingProofService";
import { fetchLandingCommunityShowcase } from "@/app/lib/landing/communityShowcaseService";
import { NarrativeLandingPage } from "@/app/landing/NarrativeLandingPage";
import { selectLandingCreatorProofs } from "@/app/landing/narrativeData";
import {
  landingJsonLd,
  landingProductJsonLd,
  landingMetadata,
  landingOrganizationJsonLd,
} from "@/seo/landing";

// Exportar metadados é permitido aqui porque não há "use client"
export const metadata = landingMetadata;

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = new URLSearchParams();
  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry));
  });

  if (query.get("board") === "post-creation") {
    query.delete("board");
    const queryString = query.toString();
    redirect(queryString ? `/calendar?${queryString}` : "/calendar");
  }

  const [casting, proofMetrics, communityCreators] = await Promise.all([
    fetchCastingCreators({ mode: "featured", limit: 8 }).catch(() => ({ creators: [], total: 0 })),
    fetchLandingProofMetrics().catch(() => null),
    fetchLandingCommunityShowcase().catch(() => []),
  ]);
  const creators = selectLandingCreatorProofs(casting.creators, 8);

  return (
    <>
      {/* Os scripts LD+JSON são melhor renderizados no Server Component raiz */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            landingJsonLd,
            landingProductJsonLd,
            landingOrganizationJsonLd,
          ]),
        }}
      />
      <NarrativeLandingPage creators={creators} proofMetrics={proofMetrics} communityCreators={communityCreators} />
    </>
  );
}

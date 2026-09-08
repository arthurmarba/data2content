import { collectCreatorAds } from "./collectors/creatorAds";
import { collectInfluencerBrasil } from "./collectors/influencerBrasil";
import { collectNinetyNineFreelas } from "./collectors/ninetyNineFreelas";
import { collectPlayNest } from "./collectors/playNest";
import { collectPublicEventCalls } from "./collectors/publicEventCalls";
import { collectSquid } from "./collectors/squid";
import { sortOpportunities } from "./normalization";
import type { CampaignRadarBatch } from "./types";
import { collectionBlockReason, collectionPolicy } from "./collectionPolicy";
import { sourceRegistryEntry } from "./sourceRegistry";
import { withCollectionBudget } from "./http";

export function campaignReportDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function collectCampaignRadar(params?: {
  now?: Date;
  influencerBrasilMaxProjects?: number;
  squidMaxArticles?: number;
}): Promise<CampaignRadarBatch> {
  return withCollectionBudget(() => collectBatch(params));
}

async function collectBatch(params: Parameters<typeof collectCampaignRadar>[0]): Promise<CampaignRadarBatch> {
  const now = params?.now ?? new Date();
  async function guarded(sourceId: string, collect: () => Promise<{ opportunities: CampaignRadarBatch["opportunities"]; coverage: CampaignRadarBatch["sources"][number] }>) {
    const source = sourceRegistryEntry(sourceId)!;
    try {
      const blocked = collectionBlockReason(collectionPolicy(sourceId), now);
      if (blocked) throw new Error(blocked);
      return await collect();
    } catch (error) {
      return { opportunities: [], coverage: { sourceId, sourcePlatform: source.sourcePlatform, discoveryUrl: source.publicCheckUrl,
        fetchedAt: now.toISOString(), discoveredDocuments: 0, emittedOpportunities: 0,
        warnings: [error instanceof Error ? error.message : "Falha na coleta."],
      } };
    }
  }
  const [influencerBrasil, squid, creatorAds, playNest, ninetyNineFreelas, publicEventCalls] = await Promise.all([
    guarded("influencer-brasil", () => collectInfluencerBrasil({ now, maxProjects: params?.influencerBrasilMaxProjects })),
    guarded("squid-public-campaigns", () => collectSquid({ now, maxArticles: params?.squidMaxArticles })),
    guarded("creator-ads-public-calls", () => collectCreatorAds({ now })),
    guarded("playnest-public-programs", () => collectPlayNest({ now })),
    guarded("ninety-nine-freelas-public", () => collectNinetyNineFreelas({ now })),
    collectPublicEventCalls({ now }),
  ]);

  return {
    schemaVersion: "campaign_radar_batch_v1",
    generatedAt: now.toISOString(),
    reportDate: campaignReportDate(now),
    coverageStatement:
      "Oportunidades encontradas em paginas publicas das fontes monitoradas pela Data2Content. Nao inclui convites privados nem garante cobertura integral do mercado.",
    sources: [
      influencerBrasil.coverage,
      squid.coverage,
      creatorAds.coverage,
      playNest.coverage,
      ninetyNineFreelas.coverage,
      ...publicEventCalls.coverages,
    ],
    opportunities: sortOpportunities([
      ...influencerBrasil.opportunities,
      ...squid.opportunities,
      ...creatorAds.opportunities,
      ...playNest.opportunities,
      ...ninetyNineFreelas.opportunities,
      ...publicEventCalls.opportunities,
    ]),
  };
}

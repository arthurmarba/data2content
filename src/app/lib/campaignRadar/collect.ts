import { collectCreatorAds } from "./collectors/creatorAds";
import { collectInfluencerBrasil } from "./collectors/influencerBrasil";
import { collectNinetyNineFreelas } from "./collectors/ninetyNineFreelas";
import { collectPlayNest } from "./collectors/playNest";
import { collectPublicEventCalls } from "./collectors/publicEventCalls";
import { collectSquid } from "./collectors/squid";
import { sortOpportunities } from "./normalization";
import type { CampaignRadarBatch } from "./types";

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
  const now = params?.now ?? new Date();
  const [influencerBrasil, squid, creatorAds, playNest, ninetyNineFreelas, publicEventCalls] = await Promise.all([
    collectInfluencerBrasil({ now, maxProjects: params?.influencerBrasilMaxProjects }),
    collectSquid({ now, maxArticles: params?.squidMaxArticles }),
    collectCreatorAds({ now }),
    collectPlayNest({ now }),
    collectNinetyNineFreelas({ now }),
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

import type { IAudienceDemographics } from "@/app/models/demographics/AudienceDemographicSnapshot";
import { getLatestAudienceDemographics } from "@/app/lib/dataService/demographicService";
import type { VideoNarrativeAudienceContextSummary } from "./videoNarrativeAiProviderTypes";

// Condensa o snapshot demográfico real (Graph) num resumo curto e humano para ancorar
// o eixo "audiência" do veredito "vale postar?". Fonte frágil por natureza (exige
// snapshot demográfico do Instagram) — quando ausente, retorna null e a IA responde
// audienceCoherence.verdict = "unknown" em vez de inventar alinhamento.
// Ver [[card-audiencia-vs-midiakit-fontes]] para a fragilidade da demografia.

const GENDER_LABEL: Record<string, string> = {
  M: "homens",
  F: "mulheres",
  U: "não informado",
  male: "homens",
  female: "mulheres",
  unknown: "não informado",
};

function topEntry(dist: Record<string, number> | undefined): { key: string; pct: number } | null {
  if (!dist) return null;
  const entries = Object.entries(dist).filter(([, v]) => typeof v === "number" && v > 0);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total <= 0) return null;
  const [key, value] = entries.sort((a, b) => b[1] - a[1])[0]!;
  return { key, pct: Math.round((value / total) * 100) };
}

function topKeys(dist: Record<string, number> | undefined, limit: number): string[] {
  if (!dist) return [];
  return Object.entries(dist)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

/** Pure summariser — safe to unit-test without a DB. Returns null when there is no usable signal. */
export function summarizeAudienceDemographics(
  demo: IAudienceDemographics | null | undefined,
): VideoNarrativeAudienceContextSummary | null {
  if (!demo) return null;
  // Prefere a audiência engajada (quem interage) e cai para os seguidores em geral.
  const source = demo.engaged_audience_demographics ?? demo.follower_demographics ?? undefined;
  const fallback = demo.follower_demographics ?? undefined;

  const gender = topEntry(source?.gender) ?? topEntry(fallback?.gender);
  const age = topEntry(source?.age) ?? topEntry(fallback?.age);
  const locations = topKeys(source?.city, 2).length > 0 ? topKeys(source?.city, 2) : topKeys(source?.country, 2);

  const summary: VideoNarrativeAudienceContextSummary = {
    topGender: gender ? GENDER_LABEL[gender.key] ?? gender.key : null,
    topGenderPct: gender?.pct ?? null,
    topAgeRange: age?.key ?? null,
    topAgeRangePct: age?.pct ?? null,
    topLocations: locations,
  };

  // Sem nenhum sinal aproveitável, não vale ocupar o prompt.
  if (!summary.topGender && !summary.topAgeRange && (summary.topLocations?.length ?? 0) === 0) {
    return null;
  }
  return summary;
}

/** Fetches the latest demographic snapshot and condenses it. Non-throwing at the call site is the caller's job. */
export async function buildAudienceContextSummary(
  userId: string,
): Promise<VideoNarrativeAudienceContextSummary | null> {
  const demo = await getLatestAudienceDemographics(userId);
  return summarizeAudienceDemographics(demo);
}

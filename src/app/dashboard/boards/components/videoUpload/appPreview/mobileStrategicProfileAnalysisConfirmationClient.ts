import type { MobileStrategicProfileAnalyzeConfirmationData } from "./MobileStrategicProfileAnalyzeFlow";
import {
  buildData2ContentNarrativeContract,
  uniqueD2CTexts,
} from "@/app/dashboard/boards/videoUpload/data2contentNarrativeContract";

type ReadingConfirmationPayload = {
  contentPotentialScan?: MobileStrategicProfileAnalyzeConfirmationData["contentPotentialScan"];
  videoReading?: {
    summary?: string | null;
    whatVideoReveals?: string | null;
    mainNarrative?: string | null;
    dominantInsight?: string | null;
  } | null;
  commercialReading?: {
    brandTerritories?: string[] | null;
  } | null;
  strategicRecommendation?: {
    nextExperiment?: string | null;
  } | null;
  profileContribution?: {
    profileImpactPreview?: string | null;
  } | null;
};

function cleanText(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  return text.length >= 3 ? text : null;
}

export function buildAnalysisConfirmationDataFromReading(
  reading: ReadingConfirmationPayload,
): MobileStrategicProfileAnalyzeConfirmationData | null {
  const contract = buildData2ContentNarrativeContract({
    videoSubject: reading.videoReading?.summary,
    mainNarrative: reading.videoReading?.mainNarrative,
    whatVideoCommunicates: reading.videoReading?.whatVideoReveals ?? reading.videoReading?.summary,
    strategicReading: reading.videoReading?.dominantInsight,
    brandTerritories: reading.commercialReading?.brandTerritories ?? [],
    nextActions: [reading.strategicRecommendation?.nextExperiment ?? ""],
  });
  const summary = cleanText(contract.creatorPointOfView);
  const narrative = cleanText(contract.centralNarrativeCandidate);
  const insight = cleanText(contract.strategicThesis);
  const impact = cleanText(reading.profileContribution?.profileImpactPreview);
  const territory = (reading.commercialReading?.brandTerritories ?? [])
    .map(cleanText)
    .find(Boolean) ?? null;
  const nextExperiment = cleanText(contract.nextExperiment);

  const unlockedSignals = uniqueD2CTexts([
    narrative ? `Sinal narrativo: ${narrative}` : null,
    insight,
    impact,
  ], 2);
  const opportunities = uniqueD2CTexts([
    nextExperiment ? `Próximo passo: ${nextExperiment}` : null,
    territory ? `Território em observação: ${territory}` : null,
  ], 1);

  if (!summary && unlockedSignals.length === 0 && opportunities.length === 0 && !reading.contentPotentialScan) return null;

  return {
    diagnosisSummary: summary,
    unlockedSignals,
    opportunities,
    contentPotentialScan: reading.contentPotentialScan ?? null,
  };
}

export async function fetchAnalysisConfirmationDataFromReading(
  diagnosisId: string | null | undefined,
): Promise<MobileStrategicProfileAnalyzeConfirmationData | null> {
  const id = diagnosisId?.trim();
  if (!id) return null;

  try {
    const response = await fetch(
      `/api/dashboard/mobile-strategic-profile/reading/${encodeURIComponent(id)}`,
    );
    if (!response.ok) return null;
    const reading = await response.json();
    return buildAnalysisConfirmationDataFromReading(reading);
  } catch {
    return null;
  }
}

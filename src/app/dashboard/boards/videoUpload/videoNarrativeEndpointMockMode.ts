import { sanitizeVideoNarrativePayloadText, type VideoNarrativeNormalizedAnalyzePayload } from "./videoNarrativePayloadValidation";
import type { VideoNarrativeMockProviderScenario } from "./videoNarrativeMockProvider";

export type VideoNarrativeInternalProviderMode = "disabled" | "mock" | "real";

export function getVideoNarrativeInternalProviderMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): VideoNarrativeInternalProviderMode {
  if (env.VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE === "mock") {
    return "mock";
  }

  if (env.VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE === "real") {
    return "real";
  }

  return "disabled";
}

function normalizeSearchText(payload: VideoNarrativeNormalizedAnalyzePayload): string {
  const knownNarratives = payload.creatorContext?.knownNarratives ?? [];
  return sanitizeVideoNarrativePayloadText([
    payload.creatorQuestion ?? "",
    payload.creatorContext?.handle ?? "",
    payload.creatorContext?.niche ?? "",
    ...knownNarratives,
  ].join(" "))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function resolveVideoNarrativeMockScenarioFromPayload(
  payload: VideoNarrativeNormalizedAnalyzePayload,
): VideoNarrativeMockProviderScenario {
  const text = normalizeSearchText(payload);

  if (/\b(marca|publi|brand)\b/.test(text)) {
    return "brand_potential";
  }

  if (/\bgancho\b/.test(text)) {
    return "weak_hook";
  }

  if (/\b(collab|colaboracao)\b/.test(text)) {
    return "collab_potential";
  }

  if (/\b(bastidor|processo)\b/.test(text)) {
    return "backstage_process";
  }

  if (/\b(anuncio|adaptacao|ad)\b/.test(text)) {
    return "ad_adaptation";
  }

  if (/(nao sei|confuso|duvida)/.test(text)) {
    return "unclear_content";
  }

  return "skincare_routine";
}

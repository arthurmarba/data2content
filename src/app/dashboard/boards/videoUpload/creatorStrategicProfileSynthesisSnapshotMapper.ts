import type { MobileStrategicProfileSnapshotPayload } from "./mobileStrategicProfileSnapshotTypes";
import type {
  CreatorStrategicProfileSynthesis,
  CreatorStrategicProfileSynthesisSignal,
  CreatorStrategicProfileSynthesisStatus,
} from "./creatorStrategicProfileSynthesis";

export const CREATOR_PROFILE_SYNTHESIS_SNAPSHOT_VERSION = "creator_profile_synthesis_snapshot_v1";
export const CREATOR_PROFILE_SYNTHESIS_SNAPSHOT_SOURCE = "video_reading_synthesis_v1";

export interface CreatorStrategicProfileSynthesisSnapshotMappingInput {
  synthesis: CreatorStrategicProfileSynthesis;
  previousSnapshot?: MobileStrategicProfileSnapshotPayload | null;
}

const FORBIDDEN_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/https?:\/\/[^\s"'<>]+/gi, "referencia removida"],
  [/\b(?:objectKey|signedUrl|uploadUrl|thumbnailUrl|localPath|storageProviderPath)\b/gi, "referencia removida"],
  [/\b(?:storage|raw response|raw model response|Gemini)\b/gi, "leitura estruturada"],
  [/\b(?:score|nota|pontuacao|pontuação)\b/gi, "leitura"],
  [/\bviralizar\b/gi, "crescer com consistencia"],
  [/\bgarantid[oa]\b/gi, "possivel"],
  [/\bcerteza\b/gi, "hipotese"],
  [/\bcomprovad[oa]\b/gi, "em observacao"],
  [/\bmatch\s+real\b/gi, "fit narrativo possivel"],
  [/\bpubli\s+garantida\b/gi, "oportunidade em formacao"],
];

function cleanText(value: string | null | undefined, fallback = ""): string {
  const raw = value?.trim() || fallback;
  return FORBIDDEN_TEXT_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), raw)
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value: string, maxLength: number): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function unique(values: string[], maxItems: number): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => limitText(value, 180))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

function signalLine(prefix: string, signal: CreatorStrategicProfileSynthesisSignal): string {
  return `${prefix}: ${signal.label}`;
}

function statusLabel(status: CreatorStrategicProfileSynthesisStatus): string {
  if (status === "empty") return "Sem leituras acumuladas";
  if (status === "first_reading") return "Primeira leitura";
  if (status === "signals_emerging") return "Sinais em formacao";
  if (status === "profile_consistent") return "Perfil consistente";
  return "Padrao em formacao";
}

function diagnosisSummaryFor(synthesis: CreatorStrategicProfileSynthesis): string {
  if (synthesis.status === "empty") {
    return "Ainda nao ha leituras documentadas suficientes para atualizar o Perfil acumulado.";
  }

  if (synthesis.status === "first_reading") {
    const signal = synthesis.testedNarratives[0] ?? synthesis.strengths[0];
    return signal
      ? `Primeiro sinal em observacao: ${signal.label}. Ainda e cedo para tratar como padrao do Perfil.`
      : "Primeira leitura registrada. Ainda e cedo para tratar como padrao do Perfil.";
  }

  if (synthesis.status === "signals_emerging") {
    return synthesis.mainNarrative
      ? `Sinal em formacao: ${synthesis.mainNarrative.label}. A leitura acumulada ainda pede novas evidencias.`
      : "Sinais em formacao aparecem nas leituras, ainda sem narrativa principal consolidada.";
  }

  if (synthesis.mainNarrative) {
    return `Sintese acumulada: ${synthesis.mainNarrative.label}. ${synthesis.mainNarrative.summary}`;
  }

  return "Padroes em formacao aparecem nas leituras acumuladas, com recomendacao de novos testes.";
}

function commercialSummaryFor(synthesis: CreatorStrategicProfileSynthesis): string {
  const territories = synthesis.commercialTerritories.map((territory) => territory.label);
  if (!territories.length) {
    return "Ainda nao ha territorio comercial recorrente suficiente; manter oportunidades como hipotese.";
  }

  return `Territorios em formacao: ${territories.slice(0, 3).join(", ")}. Fit narrativo possivel, sem promessa de acordo comercial.`;
}

function lastAnalysisSummaryFor(synthesis: CreatorStrategicProfileSynthesis): string {
  if (synthesis.nextStrategicMove) {
    return `${synthesis.nextStrategicMove.label}: ${synthesis.nextStrategicMove.description}`;
  }

  return "Proximo movimento: gerar novas leituras documentadas antes de atualizar a narrativa principal.";
}

function recurringPatternsFor(
  synthesis: CreatorStrategicProfileSynthesis,
  previousSnapshot?: MobileStrategicProfileSnapshotPayload | null,
): string[] {
  if (synthesis.status === "empty") {
    return previousSnapshot?.recurringPatterns ?? [];
  }

  if (synthesis.status === "first_reading") {
    return previousSnapshot?.recurringPatterns ?? [];
  }

  if (synthesis.status === "signals_emerging") {
    return previousSnapshot?.recurringPatterns ?? [];
  }

  return unique(synthesis.recurringPatterns.map((signal) => signalLine("Padrao em formacao", signal)), 5);
}

export function mapCreatorStrategicProfileSynthesisToSnapshotPayload(
  input: CreatorStrategicProfileSynthesisSnapshotMappingInput,
): MobileStrategicProfileSnapshotPayload {
  const { synthesis, previousSnapshot } = input;
  const recurringPatterns = recurringPatternsFor(synthesis, previousSnapshot);
  const unlockedSignals = unique([
    statusLabel(synthesis.status),
    ...synthesis.strengths.map((signal) => signalLine("Forca observada", signal)),
    ...(synthesis.mainNarrative ? [signalLine("Narrativa acumulada", synthesis.mainNarrative)] : []),
  ], 6);
  const pendingSignals = unique([
    ...synthesis.testedNarratives.map((signal) => signalLine("Hipotese em teste", signal)),
    ...synthesis.recurringTensions.map((signal) => signalLine("Ponto de atencao recorrente", signal)),
    ...synthesis.warnings.map((warning) => warning.message),
  ], 6);
  const opportunities = unique([
    ...synthesis.commercialTerritories.map((signal) => signalLine("Territorio em formacao", signal)),
    ...synthesis.collabTerritories.map((signal) => signalLine("Tipo de collab possivel", signal)),
  ], 6);

  return {
    schemaVersion: "mobile_strategic_profile_snapshot_v1",
    profileState: synthesis.status,
    unlockedSignals,
    pendingSignals,
    recurringPatterns,
    opportunities,
    diagnosisSummary: limitText(diagnosisSummaryFor(synthesis), 2000),
    commercialSummary: limitText(commercialSummaryFor(synthesis), 1200),
    lastAnalysisSummary: limitText(lastAnalysisSummaryFor(synthesis), 1200),
    extraData: {
      synthesisVersion: CREATOR_PROFILE_SYNTHESIS_SNAPSHOT_VERSION,
      synthesisUpdatedAt: synthesis.generatedAt,
      synthesisSource: CREATOR_PROFILE_SYNTHESIS_SNAPSHOT_SOURCE,
      analyzedReadingsCount: synthesis.analyzedReadingsCount,
      synthesisStatus: synthesis.status,
      synthesisWarnings: synthesis.warnings.map((warning) => ({
        code: cleanText(warning.code),
        message: cleanText(warning.message),
      })),
    },
  };
}

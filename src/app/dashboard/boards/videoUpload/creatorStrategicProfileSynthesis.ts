import type { CreatorVideoNarrativeDiagnosisSafeReading } from "./creatorVideoNarrativeDiagnosisReadService";

export type CreatorStrategicProfileSynthesisStatus =
  | "empty"
  | "first_reading"
  | "signals_emerging"
  | "pattern_in_formation"
  | "profile_consistent";

export type CreatorStrategicProfileSynthesisConfidence = "low" | "medium" | "high";

export interface CreatorStrategicProfileSynthesisSignal {
  label: string;
  summary: string;
  evidenceCount: number;
}

export interface CreatorStrategicProfileSynthesis {
  id: string;
  status: CreatorStrategicProfileSynthesisStatus;
  analyzedReadingsCount: number;
  mainNarrative: (CreatorStrategicProfileSynthesisSignal & {
    confidence: CreatorStrategicProfileSynthesisConfidence;
  }) | null;
  testedNarratives: CreatorStrategicProfileSynthesisSignal[];
  recurringPatterns: CreatorStrategicProfileSynthesisSignal[];
  recurringTensions: CreatorStrategicProfileSynthesisSignal[];
  strengths: CreatorStrategicProfileSynthesisSignal[];
  commercialTerritories: CreatorStrategicProfileSynthesisSignal[];
  collabTerritories: CreatorStrategicProfileSynthesisSignal[];
  nextStrategicMove: {
    label: string;
    description: string;
    reason: string;
  } | null;
  warnings: Array<{
    code: string;
    message: string;
  }>;
  generatedAt: string;
}

export interface BuildCreatorStrategicProfileSynthesisInput {
  readings: CreatorVideoNarrativeDiagnosisSafeReading[];
  accessLevel?: "free" | "premium" | "instagram_optimized";
  instagramConnected?: boolean;
  generatedAt?: string;
}

type SignalBucket = {
  label: string;
  samples: string[];
  diagnosisIds: Set<string>;
};

const GENERATED_AT = "2026-05-20T00:00:00.000Z";

const SAFE_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/https?:\/\/[^\s"'<>]+/gi, "referencia removida"],
  [/\b(?:objectKey|signedUrl|uploadUrl|thumbnailUrl|localPath|storageProviderPath)\b/gi, "referencia removida"],
  [/\b(?:storage|raw response|Gemini)\b/gi, "leitura estruturada"],
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
  return SAFE_TEXT_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), raw)
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value: string, maxLength: number): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function normalizeKey(value: string): string {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4)
    .slice(0, 6)
    .join(" ");
}

function firstText(values: Array<string | null | undefined>, fallback: string): string {
  return cleanText(values.find((value) => value?.trim()), fallback);
}

function pushBucket(
  buckets: Map<string, SignalBucket>,
  params: { label: string; sample: string; diagnosisId: string },
): void {
  const label = limitText(params.label, 90);
  if (!label) return;
  const key = normalizeKey(label);
  if (!key) return;

  const current = buckets.get(key) ?? {
    label,
    samples: [],
    diagnosisIds: new Set<string>(),
  };
  current.samples.push(cleanText(params.sample, label));
  current.diagnosisIds.add(params.diagnosisId);
  buckets.set(key, current);
}

function signalsFromBuckets(buckets: Map<string, SignalBucket>, maxItems = 4): CreatorStrategicProfileSynthesisSignal[] {
  return [...buckets.values()]
    .sort((a, b) => b.diagnosisIds.size - a.diagnosisIds.size || a.label.localeCompare(b.label))
    .slice(0, maxItems)
    .map((bucket) => ({
      label: bucket.label,
      summary: limitText(bucket.samples[0] ?? bucket.label, 180),
      evidenceCount: bucket.diagnosisIds.size,
    }));
}

function uniqueReadings(readings: CreatorVideoNarrativeDiagnosisSafeReading[]): CreatorVideoNarrativeDiagnosisSafeReading[] {
  const seen = new Set<string>();
  return readings.filter((reading) => {
    if (seen.has(reading.diagnosisId)) return false;
    seen.add(reading.diagnosisId);
    return true;
  });
}

function statusFor(params: {
  readingCount: number;
  strongestNarrativeEvidence: number;
  strongestPatternEvidence: number;
}): CreatorStrategicProfileSynthesisStatus {
  if (params.readingCount === 0) return "empty";
  if (params.readingCount === 1) return "first_reading";
  if (params.strongestNarrativeEvidence >= 4 || params.strongestPatternEvidence >= 4) return "profile_consistent";
  if (params.strongestNarrativeEvidence >= 3 || params.strongestPatternEvidence >= 3) return "pattern_in_formation";
  return "signals_emerging";
}

function confidenceFor(evidenceCount: number): CreatorStrategicProfileSynthesisConfidence {
  if (evidenceCount >= 4) return "high";
  if (evidenceCount >= 2) return "medium";
  return "low";
}

function buildNextStrategicMove(params: {
  status: CreatorStrategicProfileSynthesisStatus;
  pattern: CreatorStrategicProfileSynthesisSignal | undefined;
  tension: CreatorStrategicProfileSynthesisSignal | undefined;
}): CreatorStrategicProfileSynthesis["nextStrategicMove"] {
  if (params.status === "empty") return null;

  if (params.tension && params.tension.evidenceCount >= 2) {
    return {
      label: "Testar a tensão mais recorrente",
      description: `Grave 3 vídeos começando direto por "${params.tension.label}" para observar se essa identificação se repete.`,
      reason: "A mesma tensão apareceu em mais de uma leitura e pode separar padrão de hipótese.",
    };
  }

  if (params.pattern && params.pattern.evidenceCount >= 2) {
    return {
      label: "Repetir o sinal mais claro",
      description: `Crie 3 variações de "${params.pattern.label}" mantendo abertura, conflito e fechamento comparáveis.`,
      reason: "Há sinal recorrente suficiente para testar consistência sem tratar como narrativa definitiva.",
    };
  }

  return {
    label: "Criar mais duas leituras",
    description: "Analise vídeos com formatos parecidos para descobrir se o primeiro sinal se repete.",
    reason: "Um vídeo isolado ainda não deve redefinir o Perfil geral.",
  };
}

export function buildCreatorStrategicProfileSynthesis(
  input: BuildCreatorStrategicProfileSynthesisInput,
): CreatorStrategicProfileSynthesis {
  const readings = uniqueReadings(input.readings);
  const generatedAt = input.generatedAt ?? GENERATED_AT;
  const narrativeBuckets = new Map<string, SignalBucket>();
  const testedNarrativeBuckets = new Map<string, SignalBucket>();
  const patternBuckets = new Map<string, SignalBucket>();
  const tensionBuckets = new Map<string, SignalBucket>();
  const strengthBuckets = new Map<string, SignalBucket>();
  const commercialBuckets = new Map<string, SignalBucket>();
  const collabBuckets = new Map<string, SignalBucket>();
  const warnings: CreatorStrategicProfileSynthesis["warnings"] = [];

  readings.forEach((reading) => {
    const diagnosisId = reading.diagnosisId;
    const narrativeLabel = firstText(
      [reading.videoReading.mainNarrative, reading.videoReading.dominantInsight, reading.videoReading.title],
      "Narrativa em observação",
    );
    const narrativeSummary = firstText(
      [reading.videoReading.summary, reading.videoReading.whatVideoReveals, reading.profileContribution.reason],
      "Sinal narrativo em observação.",
    );

    if (reading.profileContribution.type === "confirms_existing_pattern") {
      pushBucket(patternBuckets, { label: narrativeLabel, sample: narrativeSummary, diagnosisId });
      pushBucket(narrativeBuckets, { label: narrativeLabel, sample: narrativeSummary, diagnosisId });
    }

    if (reading.profileContribution.type === "opens_new_hypothesis") {
      pushBucket(testedNarrativeBuckets, { label: narrativeLabel, sample: narrativeSummary, diagnosisId });
    }

    if (reading.profileContribution.type === "isolated_strong_video") {
      pushBucket(strengthBuckets, { label: narrativeLabel, sample: narrativeSummary, diagnosisId });
    }

    if (reading.profileContribution.type === "creative_deviation") {
      pushBucket(testedNarrativeBuckets, { label: `Desvio criativo: ${narrativeLabel}`, sample: narrativeSummary, diagnosisId });
    }

    if (reading.profileContribution.type === "commercial_signal") {
      reading.commercialReading.brandTerritories.forEach((territory) => {
        pushBucket(commercialBuckets, {
          label: territory,
          sample: reading.commercialReading.summary || reading.commercialReading.whyItCouldFitBrands,
          diagnosisId,
        });
      });
      pushBucket(collabBuckets, {
        label: "Collab de problema, escolha e consequência",
        sample: reading.commercialReading.adAdaptationIdea,
        diagnosisId,
      });
    }

    if (reading.profileContribution.type === "weak_positioning_signal") {
      warnings.push({
        code: "weak_positioning_signal",
        message: "Uma leitura ainda está fraca para influenciar o Perfil geral.",
      });
    }

    if (reading.profileContribution.type === "needs_more_samples") {
      warnings.push({
        code: "needs_more_samples",
        message: "Ainda faltam leituras para separar hipótese inicial de padrão.",
      });
    }

    pushBucket(tensionBuckets, {
      label: firstText(
        [
          reading.strategicRecommendation.mainAdjustment,
          reading.videoReading.whatVideoReveals,
          reading.speechReading.openingRead,
        ],
        "Abertura precisa chegar mais rápido ao conflito",
      ),
      sample: firstText(
        [reading.strategicRecommendation.nextExperiment, reading.speechReading.suggestedOpening],
        "Testar uma abertura mais direta em novas leituras.",
      ),
      diagnosisId,
    });

    pushBucket(strengthBuckets, {
      label: firstText([reading.strategicRecommendation.whatToRepeat, reading.videoReading.dominantInsight], narrativeLabel),
      sample: firstText([reading.videoReading.summary, reading.profileContribution.profileImpactPreview], narrativeSummary),
      diagnosisId,
    });
  });

  const testedNarratives = signalsFromBuckets(testedNarrativeBuckets);
  const recurringPatterns = signalsFromBuckets(patternBuckets);
  const recurringTensions = signalsFromBuckets(tensionBuckets).filter((signal) => signal.evidenceCount >= 2);
  const strengths = signalsFromBuckets(strengthBuckets);
  const commercialTerritories = signalsFromBuckets(commercialBuckets);
  const collabTerritories = signalsFromBuckets(collabBuckets);
  const narrativeSignals = signalsFromBuckets(narrativeBuckets);
  const strongestNarrative = narrativeSignals[0];
  const strongestPattern = recurringPatterns[0];
  const status = statusFor({
    readingCount: readings.length,
    strongestNarrativeEvidence: strongestNarrative?.evidenceCount ?? 0,
    strongestPatternEvidence: strongestPattern?.evidenceCount ?? 0,
  });
  const canHaveMainNarrative =
    readings.length >= 2 &&
    Boolean(strongestNarrative) &&
    (strongestNarrative?.evidenceCount ?? 0) >= 2 &&
    status !== "first_reading";

  const mainNarrative = canHaveMainNarrative && strongestNarrative
    ? {
        label: strongestNarrative.label,
        summary:
          status === "signals_emerging"
            ? limitText(`Sinal em formação: ${strongestNarrative.summary}`, 180)
            : limitText(`Essa narrativa começa a se repetir: ${strongestNarrative.summary}`, 180),
        confidence: confidenceFor(strongestNarrative.evidenceCount),
        evidenceCount: strongestNarrative.evidenceCount,
      }
    : null;

  if (readings.length === 1) {
    warnings.push({
      code: "single_reading_not_profile",
      message: "Primeiro sinal: ainda é cedo para chamar de padrão.",
    });
  }

  return {
    id: `profile-synthesis-v1-${readings.length}-${mainNarrative?.evidenceCount ?? 0}`,
    status,
    analyzedReadingsCount: readings.length,
    mainNarrative,
    testedNarratives,
    recurringPatterns,
    recurringTensions,
    strengths,
    commercialTerritories,
    collabTerritories,
    nextStrategicMove: buildNextStrategicMove({
      status,
      pattern: strongestPattern,
      tension: recurringTensions[0],
    }),
    warnings,
    generatedAt,
  };
}

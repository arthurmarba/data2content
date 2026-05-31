import type { CreatorVideoNarrativeDiagnosisSafeReading } from "./creatorVideoNarrativeDiagnosisReadService";
import type { VideoNarrativeCoherenceVerdict } from "./creatorVideoNarrativeDiagnosisTypes";
import {
  buildData2ContentNarrativeContract,
  compactD2CNarrativeLabel,
  compactD2CNextExperiment,
  compactD2CTension,
} from "./data2contentNarrativeContract";

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
  /** Diagnosis IDs of readings that contributed to this signal (for drill-down) */
  diagnosisIds: string[];
}

export type CreatorStrategicProfileExecutionArea = "speech" | "production";

export interface CreatorStrategicProfileExecutionPattern {
  area: CreatorStrategicProfileExecutionArea;
  label: string;
  summary: string;
  evidenceCount: number;
  diagnosisIds: string[];
}

export interface CreatorStrategicProfileCommercialReasoning {
  label: string;
  summary: string;
  evidenceCount: number;
  diagnosisIds: string[];
}

export interface CreatorStrategicProfileTacticalExperiment {
  label: string;
  summary: string;
  evidenceCount: number;
  diagnosisIds: string[];
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
  /** Narrative territories derived from the creator's videos (distinct from commercial territories). */
  narrativeTerritories: CreatorStrategicProfileSynthesisSignal[];
  /** Dominant communication tone derived from emotionalRegister across readings. */
  dominantTone: string | null;
  /** All tone signals sorted by evidence count. */
  toneSignals: CreatorStrategicProfileSynthesisSignal[];
  /** Aggregated speech + production patterns derived from each reading */
  executionPatterns: CreatorStrategicProfileExecutionPattern[];
  /** Aggregated "why brands would care" reasoning across commercial readings */
  commercialReasoning: CreatorStrategicProfileCommercialReasoning[];
  /** Contextual next-experiment suggestions derived from synthesis state */
  tacticalExperiments: CreatorStrategicProfileTacticalExperiment[];
  /**
   * Life-asset signals observed across readings (setting, socialPresence, emotionalRegister,
   * lifeSignals, etc.). Each entry represents a signal seen in 1+ readings.
   * Sorted by evidenceCount descending — top entry is `topPerformingPattern`.
   */
  confirmedLifeAssets: CreatorStrategicProfileSynthesisSignal[];
  /** Label of the most-repeated life-asset combination — the creator's narrative fingerprint. */
  topPerformingPattern: string | null;
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
  // Block commercial performance language that can slip through Gemini's generation
  [/\balto\s+potencial\b/gi, "potencial em formacao"],
  [/\bgrande\s+fit\b/gi, "fit possivel"],
  [/\bmuito\s+forte\b/gi, "com sinal claro"],
  [/\bperfil\s+ideal\s+para\b/gi, "perfil com fit possivel para"],
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
  // Trim to word boundary — avoid persisting mid-word truncations like "estratégi"
  const cut = text.slice(0, maxLength - 3);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trim()}...`;
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
      // Use the most recent sample (last push) for freshness rather than always showing the first reading's text.
      summary: limitText(bucket.samples.at(-1) ?? bucket.samples[0] ?? bucket.label, 180),
      evidenceCount: bucket.diagnosisIds.size,
      diagnosisIds: [...bucket.diagnosisIds],
    }));
}

function executionPatternsFromBuckets(
  buckets: Map<string, SignalBucket>,
  area: CreatorStrategicProfileExecutionArea,
  maxItems = 2,
): CreatorStrategicProfileExecutionPattern[] {
  return [...buckets.values()]
    .sort((a, b) => b.diagnosisIds.size - a.diagnosisIds.size || a.label.localeCompare(b.label))
    .slice(0, maxItems)
    .map((bucket) => ({
      area,
      label: bucket.label,
      summary: limitText(bucket.samples.at(-1) ?? bucket.samples[0] ?? bucket.label, 180),
      evidenceCount: bucket.diagnosisIds.size,
      diagnosisIds: [...bucket.diagnosisIds],
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
  readingCount: number;
  pattern: CreatorStrategicProfileSynthesisSignal | undefined;
  tension: CreatorStrategicProfileSynthesisSignal | undefined;
}): CreatorStrategicProfileSynthesis["nextStrategicMove"] {
  if (params.status === "empty") return null;

  if (params.readingCount >= 3 && params.tension?.label === "Separar tema do video de narrativa") {
    return {
      label: "Separar tema de narrativa",
      description: "Revise os vídeos analisados e marque quais eixos revelam o seu ponto de vista, não só o assunto de cada post.",
      reason: "Quando o mesmo ponto de vista aparecer em contextos diferentes, ele pode virar narrativa central.",
    };
  }

  if (params.tension && params.tension.evidenceCount >= 2) {
    return {
      label: params.tension.label,
      description: `Ponto de atenção que apareceu em ${params.tension.evidenceCount} leituras. Na próxima análise, observe se ainda aparece com a mesma intensidade.`,
      reason: "Quando deixar de aparecer como ponto principal, o sinal mudou — aí vale transformar em ajuste.",
    };
  }

  if (params.pattern && params.pattern.evidenceCount >= 2) {
    return {
      label: params.pattern.label,
      description: `Padrão que se repetiu em ${params.pattern.evidenceCount} leituras. Na próxima, observe se surge mesmo sem você ter planejado.`,
      reason: "Quando aparecer em mais 2 leituras sem intenção, ele pode virar narrativa central do mapa.",
    };
  }

  if (params.readingCount >= 3) {
    return {
      label: "Separe tema de narrativa",
      description: "Revise os vídeos analisados e marque quais eixos revelam o seu ponto de vista, não só o assunto de cada post.",
      reason: "Quando o mesmo ponto de vista aparecer em contextos diferentes, ele pode virar narrativa central.",
    };
  }

  return {
    label: "Adicione mais leituras",
    description: "Analise vídeos com formatos parecidos para descobrir se o primeiro sinal se repete.",
    reason: "Quando duas leituras mostrarem narrativa parecida — esse é o sinal de que um padrão começa.",
  };
}

function buildTacticalExperimentsFromSynthesis(params: {
  status: CreatorStrategicProfileSynthesisStatus;
  recurringTensions: CreatorStrategicProfileSynthesisSignal[];
  recurringPatterns: CreatorStrategicProfileSynthesisSignal[];
  testedNarratives: CreatorStrategicProfileSynthesisSignal[];
  readingCount: number;
}): CreatorStrategicProfileTacticalExperiment[] {
  const experiments: CreatorStrategicProfileTacticalExperiment[] = [];

  const topTension = params.recurringTensions.find((t) => t.evidenceCount >= 2);
  if (topTension) {
    experiments.push({
      label: topTension.label,
      summary: `Esse ponto apareceu em ${topTension.evidenceCount} leituras. Na próxima análise, observe se ele ainda aparece com a mesma força — se não aparecer, o sinal mudou.`,
      evidenceCount: topTension.evidenceCount,
      diagnosisIds: topTension.diagnosisIds,
    });
  }

  const topPattern = params.recurringPatterns.find((p) => p.evidenceCount >= 2);
  if (topPattern && experiments.length < 3) {
    experiments.push({
      label: topPattern.label,
      summary: `Padrão que se repete em ${topPattern.evidenceCount} leituras. Grave um vídeo onde esse eixo seja o ponto central — não apenas o contexto — e observe se a leitura confirma.`,
      evidenceCount: topPattern.evidenceCount,
      diagnosisIds: topPattern.diagnosisIds,
    });
  }

  const topTested = params.testedNarratives[0];
  if (topTested && experiments.length < 3) {
    experiments.push({
      label: topTested.label,
      summary: `Hipótese em observação. Uma leitura a mais desse ângulo vai confirmar ou descartar o sinal antes de entrar no mapa.`,
      evidenceCount: topTested.evidenceCount,
      diagnosisIds: topTested.diagnosisIds,
    });
  }

  if (experiments.length === 0) {
    experiments.push({
      label: "Criar mais leituras",
      summary: "Analise vídeos com formatos parecidos para descobrir se o primeiro sinal se repete.",
      evidenceCount: params.readingCount,
      diagnosisIds: [],
    });
  }

  return experiments;
}

export function buildCreatorStrategicProfileSynthesis(
  input: BuildCreatorStrategicProfileSynthesisInput,
): CreatorStrategicProfileSynthesis {
  const readings = uniqueReadings(input.readings);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const narrativeBuckets = new Map<string, SignalBucket>();
  const testedNarrativeBuckets = new Map<string, SignalBucket>();
  const patternBuckets = new Map<string, SignalBucket>();
  const tensionBuckets = new Map<string, SignalBucket>();
  const strengthBuckets = new Map<string, SignalBucket>();
  const commercialBuckets = new Map<string, SignalBucket>();
  const collabBuckets = new Map<string, SignalBucket>();
  const speechBuckets = new Map<string, SignalBucket>();
  const productionBuckets = new Map<string, SignalBucket>();
  const commercialReasoningBuckets = new Map<string, SignalBucket>();
  const toneBuckets = new Map<string, SignalBucket>();
  const territoryBuckets = new Map<string, SignalBucket>();
  // Life-asset buckets: accumulate contentContext signals across readings.
  // Each unique life signal (setting, socialPresence, emotionalRegister, lifeSignals items)
  // gets its own bucket; high evidenceCount = confirmed asset.
  const lifeAssetBuckets = new Map<string, SignalBucket>();
  const warnings: CreatorStrategicProfileSynthesis["warnings"] = [];

  readings.forEach((reading) => {
    const diagnosisId = reading.diagnosisId;
    const narrativeContract = buildData2ContentNarrativeContract({
      videoSubject: reading.videoReading.summary,
      mainNarrative: reading.videoReading.mainNarrative,
      whatVideoCommunicates: reading.videoReading.whatVideoReveals || reading.videoReading.summary,
      creatorIntent: reading.videoReading.creatorIntent,
      strategicReading: reading.videoReading.dominantInsight,
      strength: reading.strategicRecommendation.whatToRepeat,
      attentionPoint: reading.strategicRecommendation.whatToAvoid,
      recommendedAdjustment: reading.strategicRecommendation.mainAdjustment,
      suggestedHook: reading.speechReading.openingRead,
      creatorSignals: [
        reading.videoReading.title,
        reading.videoReading.dominantInsight,
        ...(reading.contentContext?.lifeSignals ?? []),
      ],
      brandTerritories: reading.commercialReading.brandTerritories,
      nextActions: [reading.strategicRecommendation.nextExperiment],
    });
    const narrativeLabel = narrativeContract.centralNarrativeCandidate;
    const narrativeSummary = firstText(
      [narrativeContract.strategicThesis, narrativeContract.creatorPointOfView, reading.profileContribution.reason],
      "Sinal narrativo em observação.",
    );

    if (reading.profileContribution.type === "confirms_existing_pattern") {
      pushBucket(patternBuckets, { label: narrativeLabel, sample: narrativeSummary, diagnosisId });
      pushBucket(narrativeBuckets, { label: narrativeLabel, sample: narrativeSummary, diagnosisId });
      pushBucket(strengthBuckets, {
        label: firstText([narrativeContract.centralNarrativeCandidate, reading.strategicRecommendation.whatToRepeat, reading.videoReading.dominantInsight], narrativeLabel),
        sample: firstText([narrativeContract.strategicThesis, reading.videoReading.summary, reading.profileContribution.profileImpactPreview], narrativeSummary),
        diagnosisId,
      });
    }

    if (reading.profileContribution.type === "opens_new_hypothesis") {
      pushBucket(testedNarrativeBuckets, { label: narrativeLabel, sample: narrativeSummary, diagnosisId });
    }

    if (reading.profileContribution.type === "isolated_strong_video") {
      pushBucket(strengthBuckets, {
        label: firstText([narrativeContract.centralNarrativeCandidate, reading.strategicRecommendation.whatToRepeat, reading.videoReading.dominantInsight], narrativeLabel),
        sample: firstText([narrativeContract.strategicThesis, reading.videoReading.summary, reading.profileContribution.profileImpactPreview], narrativeSummary),
        diagnosisId,
      });
    }

    if (reading.profileContribution.type === "creative_deviation") {
      pushBucket(testedNarrativeBuckets, { label: `Nova direção: ${narrativeLabel}`, sample: narrativeSummary, diagnosisId });
    }

    // Augment buckets using narrativeCoherence.verdict for signals the contribution type may not capture.
    const verdict = reading.narrativeCoherence?.verdict;
    if (verdict === "confirms_top_pattern" && reading.profileContribution.type !== "confirms_existing_pattern") {
      pushBucket(patternBuckets, { label: narrativeLabel, sample: narrativeSummary, diagnosisId });
    }
    if ((verdict === "experiment" || verdict === "deviation") &&
        reading.profileContribution.type !== "opens_new_hypothesis" &&
        reading.profileContribution.type !== "creative_deviation") {
      pushBucket(testedNarrativeBuckets, { label: narrativeLabel, sample: narrativeSummary, diagnosisId });
    }

    // Populate commercial territories from ANY reading that carries brand territory data,
    // not just the rare "commercial_signal" type. This ensures the Marcas/Collabs detail
    // views are populated for creators who have brand potential but whose readings are
    // typed as "confirms_existing_pattern", "opens_new_hypothesis", etc.
    reading.commercialReading.brandTerritories.forEach((territory) => {
      if (territory) {
        pushBucket(commercialBuckets, {
          label: territory,
          sample: reading.commercialReading.summary || reading.commercialReading.whyItCouldFitBrands,
          diagnosisId,
        });
      }
    });

    if (
      reading.commercialReading.brandTerritories.length > 0 ||
      reading.profileContribution.type === "commercial_signal"
    ) {
      const collabLabel = firstText(
        [reading.commercialReading.brandTerritories[0] ?? null],
        "Collab de problema, escolha e consequência",
      );
      pushBucket(collabBuckets, {
        label: collabLabel,
        sample: firstText(
          [reading.commercialReading.adAdaptationIdea, reading.commercialReading.whyItCouldFitBrands],
          collabLabel,
        ),
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

    // Tensions come only from profile-level strategic fields, never from per-video speech content.
    const tensionLabel = compactD2CTension([
      reading.strategicRecommendation.mainAdjustment,
      reading.videoReading.whatVideoReveals,
    ]);
    if (tensionLabel) {
      pushBucket(tensionBuckets, {
        label: tensionLabel,
        sample: firstText(
          [reading.strategicRecommendation.nextExperiment, reading.strategicRecommendation.whatToAvoid],
          "Observe se esse ponto se repete antes de transformar em ajuste fixo.",
        ),
        diagnosisId,
      });
    }

    // ── Execution: speech aggregation ──────────────────────────────────────
    const speechLabel = firstText(
      [reading.speechReading.summary, reading.speechReading.openingRead],
      "",
    );
    if (speechLabel) {
      pushBucket(speechBuckets, {
        label: speechLabel,
        sample: firstText(
          [
            reading.speechReading.summary,
            reading.speechReading.openingRead,
            reading.speechReading.clarityRead,
            reading.speechReading.pacingRead,
          ],
          speechLabel,
        ),
        diagnosisId,
      });
    }

    // ── Execution: production aggregation ──────────────────────────────────
    // Use productionStyle (short atomic label e.g. "selfie", "vertical-raw") as the
    // bucket key so that executionPatterns.label stays concise and chip-displayable.
    // Fall back to a short compacted form of productionReading.framing only when the
    // context field is absent (older readings without contentContext).
    const productionLabel = reading.contentContext?.productionStyle
      ? reading.contentContext.productionStyle
      : firstText([reading.productionReading.framing], "");
    if (productionLabel) {
      pushBucket(productionBuckets, {
        label: productionLabel,
        sample: firstText(
          [
            reading.productionReading.summary,
            reading.productionReading.framing,
            reading.productionReading.lighting,
            reading.productionReading.audio,
          ],
          productionLabel,
        ),
        diagnosisId,
      });
    }

    // ── Commercial reasoning: "por que marcas se interessariam" ───────────
    // Allow any reading with brand territory data to contribute, not just "commercial_signal".
    const commercialWhy = firstText(
      [reading.commercialReading.whyItCouldFitBrands, reading.commercialReading.summary],
      "",
    );
    if (
      commercialWhy &&
      (reading.profileContribution.type === "commercial_signal" ||
        reading.commercialReading.brandTerritories.length > 0)
    ) {
      pushBucket(commercialReasoningBuckets, {
        label: commercialWhy,
        sample: firstText(
          [
            reading.commercialReading.whyItCouldFitBrands,
            reading.commercialReading.summary,
            reading.commercialReading.adAdaptationIdea,
          ],
          commercialWhy,
        ),
        diagnosisId,
      });
    }

    // ── Tone accumulation (emotionalRegister only — avoids mixing with life signals) ─
    const ctx = reading.contentContext;
    const narrativeSampleRef = firstText(
      [narrativeContract.centralNarrativeCandidate, narrativeContract.strategicThesis, reading.videoReading.summary],
      narrativeLabel,
    );
    if (ctx?.emotionalRegister) {
      pushBucket(toneBuckets, { label: ctx.emotionalRegister, sample: narrativeSampleRef, diagnosisId });
    }

    // ── Narrative territories — clean with compactD2CNarrativeLabel to strip raw AI prefixes ──
    narrativeContract.territories.forEach((territory) => {
      const cleaned = territory ? compactD2CNarrativeLabel([territory]) : "";
      if (cleaned) {
        pushBucket(territoryBuckets, { label: cleaned, sample: narrativeSummary, diagnosisId });
      }
    });

    // ── Life-asset accumulation ────────────────────────────────────────────
    // Life assets = what exists in the creator's real life (setting, social context,
    // life signals). emotionalRegister belongs to toneSignals; productionStyle belongs
    // to executionPatterns. Mixing them here caused tone/technique labels to contaminate
    // the "Assets de vida" section.
    if (ctx) {
      [ctx.setting, ctx.socialPresence]
        .filter((v): v is string => Boolean(v))
        .forEach((signal) =>
          pushBucket(lifeAssetBuckets, { label: signal, sample: narrativeSampleRef, diagnosisId }),
        );
      (ctx.lifeSignals ?? [])
        .filter(Boolean)
        .forEach((signal) =>
          pushBucket(lifeAssetBuckets, { label: signal, sample: narrativeSampleRef, diagnosisId }),
        );
    }
  });

  // Life assets: show all observed signals sorted by evidence count.
  // The top entry (most-repeated) becomes topPerformingPattern.
  const confirmedLifeAssets = signalsFromBuckets(lifeAssetBuckets, 10);
  const topPerformingPattern = confirmedLifeAssets[0]?.label ?? null;

  const testedNarratives = signalsFromBuckets(testedNarrativeBuckets);
  const recurringPatterns = signalsFromBuckets(patternBuckets);
  // Threshold reduzido para >= 1: tensões com uma única evidência já são sinais válidos
  // para orientar o usuário. Com >= 2 evidências o sistema as trata como "confirmadas".
  const recurringTensions = signalsFromBuckets(tensionBuckets);
  const strengths = signalsFromBuckets(strengthBuckets);
  const commercialTerritories = signalsFromBuckets(commercialBuckets);
  const collabTerritories = signalsFromBuckets(collabBuckets);
  const narrativeSignals = signalsFromBuckets(narrativeBuckets);
  const narrativeTerritories = signalsFromBuckets(territoryBuckets, 6);
  const toneSignals = signalsFromBuckets(toneBuckets, 4);
  const dominantTone = toneSignals[0]?.label ?? null;
  const executionPatterns: CreatorStrategicProfileExecutionPattern[] = [
    ...executionPatternsFromBuckets(speechBuckets, "speech", 2),
    ...executionPatternsFromBuckets(productionBuckets, "production", 2),
  ];
  const commercialReasoning = signalsFromBuckets(commercialReasoningBuckets, 3).map((s) => ({
    label: s.label,
    summary: s.summary,
    evidenceCount: s.evidenceCount,
    diagnosisIds: s.diagnosisIds,
  }));
  const strongestNarrative = narrativeSignals[0];
  const strongestPattern = recurringPatterns[0];
  const status = statusFor({
    readingCount: readings.length,
    strongestNarrativeEvidence: strongestNarrative?.evidenceCount ?? 0,
    strongestPatternEvidence: strongestPattern?.evidenceCount ?? 0,
  });
  const tacticalExperiments = buildTacticalExperimentsFromSynthesis({
    status,
    recurringTensions,
    recurringPatterns,
    testedNarratives,
    readingCount: readings.length,
  });
  // mainNarrative: exibida a partir da primeira leitura, com labels adaptados à maturidade
  const canHaveMainNarrative = Boolean(strongestNarrative && strongestNarrative.evidenceCount >= 2);

  const mainNarrative = canHaveMainNarrative && strongestNarrative
    ? {
        label: strongestNarrative.label,
        summary:
          strongestNarrative.evidenceCount === 1
            ? limitText(`Sinal inicial detectado: ${strongestNarrative.summary}`, 180)
            : status === "signals_emerging"
            ? limitText(`Sinal em formação: ${strongestNarrative.summary}`, 180)
            : limitText(`Essa narrativa começa a se repetir: ${strongestNarrative.summary}`, 180),
        confidence: confidenceFor(strongestNarrative.evidenceCount),
        evidenceCount: strongestNarrative.evidenceCount,
        diagnosisIds: strongestNarrative.diagnosisIds,
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
    narrativeTerritories,
    dominantTone,
    toneSignals,
    executionPatterns,
    commercialReasoning,
    tacticalExperiments,
    confirmedLifeAssets,
    topPerformingPattern,
    nextStrategicMove: buildNextStrategicMove({
      status,
      readingCount: readings.length,
      pattern: strongestPattern,
      tension: recurringTensions[0],
    }),
    warnings,
    generatedAt,
  };
}

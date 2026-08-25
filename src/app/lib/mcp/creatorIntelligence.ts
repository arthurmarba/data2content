import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import AccountInsightModel from "@/app/models/AccountInsight";
import CreatorMapConfirmations from "@/app/models/CreatorMapConfirmations";
import CreatorVideoNarrativeDiagnosis from "@/app/models/CreatorVideoNarrativeDiagnosis";
import CreatorWeeklyReport from "@/app/models/CreatorWeeklyReport";
import MapaSeed from "@/app/models/MapaSeed";
import ScriptOutcomeProfile from "@/app/models/ScriptOutcomeProfile";
import UserModel from "@/app/models/User";
import { D2C_INTELLIGENCE_SCHEMA_VERSION } from "./intelligenceContract";

type AnyRecord = Record<string, any>;

function asIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function cleanStrings(value: unknown, limit = 20): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean))].slice(0, limit);
}

function safeObject<T extends AnyRecord>(value: T | null | undefined): T | null {
  return value && typeof value === "object" ? value : null;
}

function confirmation(value: AnyRecord | null | undefined) {
  if (!value) return { state: "pending", response: null, confirmedAt: null };
  return {
    state: value.state ?? "pending",
    response: value.response ?? null,
    confirmedAt: asIso(value.confirmedAt),
    previousLabel: typeof value.previousLabel === "string" ? value.previousLabel : null,
  };
}

export async function getMcpCreatorIntelligenceProfile(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return null;
  await connectToDatabase();
  const objectId = new Types.ObjectId(userId);
  const [seed, confirmations, latestDiagnosis] = await Promise.all([
    MapaSeed.findOne({ userId: objectId })
      .select("mapa leituraInaugural instagramEnrichedAt videoEnrichedAt editedSections updatedAt")
      .lean<AnyRecord | null>(),
    CreatorMapConfirmations.findOne({ userId: objectId })
      .select("narrative territories tone assets endorsedHypotheses dismissedHypotheses confirmedFormats adjacentNarratives updatedAt")
      .lean<AnyRecord | null>(),
    CreatorVideoNarrativeDiagnosis.findOne({
      userId: objectId,
      status: "completed",
      historyVisibility: { $ne: "hidden" },
    })
      .sort({ createdAt: -1 })
      .select("diagnosisId profileContribution videoReading.mainNarrative videoReading.dominantInsight contentContext narrativeCoherence createdAt")
      .lean<AnyRecord | null>(),
  ]);
  if (!seed && !confirmations && !latestDiagnosis) return null;

  const map = safeObject(seed?.mapa);
  return {
    schemaVersion: "mcp_creator_intelligence_profile_v1",
    intelligenceSchemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    map: map ? {
      narrative: typeof map.narrativa_central === "string" ? map.narrativa_central : null,
      territories: cleanStrings(map.territorios),
      themes: cleanStrings(map.temas),
      adjacentNarratives: cleanStrings(map.narrativas_adjacentes),
      assets: cleanStrings(map.assets),
      assetGroups: Array.isArray(map.assetGroups)
        ? map.assetGroups.slice(0, 30).map((item: AnyRecord) => ({ label: item.label, group: item.group }))
        : [],
      tone: typeof map.tom === "string" ? map.tom : null,
      formats: cleanStrings(map.formatos),
      maturity: map.maturidade ?? null,
      sources: cleanStrings(map.fonte),
      observations: cleanStrings(map.observacoes, 10),
      instagramSampling: map.amostragem_instagram ?? null,
      updatedAt: asIso(seed?.updatedAt),
      instagramEnrichedAt: asIso(seed?.instagramEnrichedAt),
      videoEnrichedAt: asIso(seed?.videoEnrichedAt),
    } : null,
    confirmations: confirmations ? {
      narrative: confirmation(confirmations.narrative),
      territories: confirmation(confirmations.territories),
      tone: confirmation(confirmations.tone),
      assets: Array.isArray(confirmations.assets)
        ? confirmations.assets.slice(0, 30).map((item: AnyRecord) => ({
          label: item.label,
          state: item.state,
          response: item.response ?? null,
          confirmedAt: asIso(item.confirmedAt),
        }))
        : [],
      endorsedHypotheses: cleanStrings(confirmations.endorsedHypotheses),
      dismissedHypotheses: cleanStrings(confirmations.dismissedHypotheses),
      confirmedFormats: cleanStrings(confirmations.confirmedFormats),
      adjacentNarratives: Array.isArray(confirmations.adjacentNarratives)
        ? confirmations.adjacentNarratives.slice(0, 20).map((item: AnyRecord) => ({
          label: item.label,
          state: item.state,
          source: item.source,
          response: item.response ?? null,
          confirmedAt: asIso(item.confirmedAt),
        }))
        : [],
      updatedAt: asIso(confirmations.updatedAt),
    } : null,
    latestVideoContribution: latestDiagnosis ? {
      diagnosisId: latestDiagnosis.diagnosisId,
      analyzedAt: asIso(latestDiagnosis.createdAt),
      mainNarrative: latestDiagnosis.videoReading?.mainNarrative ?? null,
      dominantInsight: latestDiagnosis.videoReading?.dominantInsight ?? null,
      profileContribution: latestDiagnosis.profileContribution ?? null,
      contentContext: latestDiagnosis.contentContext ?? null,
      narrativeCoherence: latestDiagnosis.narrativeCoherence ?? null,
    } : null,
    coverage: {
      map: Boolean(seed),
      confirmations: Boolean(confirmations),
      videoEnrichment: Boolean(latestDiagnosis),
    },
  };
}

export function sanitizeMcpVideoDiagnosisDocument(doc: AnyRecord) {
  const flags = safeObject(doc.safetyFlags);
  const safe = Boolean(flags?.sanitized)
    && !flags?.containsSignedUrl
    && !flags?.containsObjectKey
    && !flags?.containsRawModelResponse
    && !flags?.containsLongTranscript
    && !flags?.containsPersistedVideoReference;
  if (!safe) return null;
  return {
    schemaVersion: "mcp_video_diagnosis_v1",
    intelligenceSchemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION,
    diagnosisId: doc.diagnosisId,
    analyzedAt: asIso(doc.videoMetadata?.analyzedAt) ?? asIso(doc.createdAt),
    durationSeconds: typeof doc.videoMetadata?.durationSeconds === "number" ? doc.videoMetadata.durationSeconds : null,
    creatorGoal: doc.creatorGoal ?? null,
    selectedGoalOption: doc.selectedGoalOption ?? null,
    videoReading: doc.videoReading ?? null,
    speechReading: doc.speechReading ?? null,
    productionReading: doc.productionReading ?? null,
    commercialReading: doc.commercialReading ?? null,
    strategicRecommendation: doc.strategicRecommendation ?? null,
    profileContribution: doc.profileContribution ?? null,
    evidenceAnchors: doc.evidenceAnchors ?? { speechQuotes: [], sceneAnchors: [] },
    contentContext: doc.contentContext ?? null,
    narrativeCoherence: doc.narrativeCoherence ?? null,
    contentPotentialScan: doc.contentPotentialScan ?? null,
    hookRecommendation: doc.hookRecommendation ?? null,
    hookSelection: doc.hookSelection ? {
      candidateId: doc.hookSelection.candidateId ?? null,
      candidate: doc.hookSelection.candidate ?? null,
      selectedAt: asIso(doc.hookSelection.selectedAt),
    } : null,
    scriptAdjustmentRecommendation: doc.scriptAdjustmentRecommendation ?? null,
    scriptAdjustmentSelection: doc.scriptAdjustmentSelection ? {
      selectedStepIds: cleanStrings(doc.scriptAdjustmentSelection.selectedStepIds),
      recommendationVersion: doc.scriptAdjustmentSelection.recommendationVersion ?? null,
      selectedAt: asIso(doc.scriptAdjustmentSelection.selectedAt),
    } : null,
    scriptAdjustmentExperimentCohort: doc.scriptAdjustmentExperimentCohort ?? null,
    publication: {
      intent: doc.publishIntent ?? null,
      linkedInstagramMediaId: doc.linkedInstagramMediaId ?? null,
      learningStatus: doc.learningStatus ?? null,
    },
    performanceOutcome: doc.performanceOutcome ? {
      reach: doc.performanceOutcome.reach ?? null,
      views: doc.performanceOutcome.views ?? null,
      watchTimeSeconds: doc.performanceOutcome.watchTimeSeconds ?? null,
      shares: doc.performanceOutcome.shares ?? null,
      saves: doc.performanceOutcome.saves ?? null,
      relativeReach: doc.performanceOutcome.relativeReach ?? null,
      relativeIntent: doc.performanceOutcome.relativeIntent ?? null,
      capturedAt: asIso(doc.performanceOutcome.capturedAt),
    } : null,
    hookOutcome: doc.hookOutcome ? {
      selectedCandidateId: doc.hookOutcome.selectedCandidateId ?? null,
      pattern: doc.hookOutcome.pattern ?? null,
      strategy: doc.hookOutcome.strategy ?? null,
      openingMatchScore: doc.hookOutcome.openingMatchScore ?? null,
      usedInPublishedOpening: doc.hookOutcome.usedInPublishedOpening ?? null,
      capturedAt: asIso(doc.hookOutcome.capturedAt),
    } : null,
    scriptAdjustmentOutcome: doc.scriptAdjustmentOutcome ? {
      recommendationVersion: doc.scriptAdjustmentOutcome.recommendationVersion ?? null,
      pattern: doc.scriptAdjustmentOutcome.pattern ?? null,
      effort: doc.scriptAdjustmentOutcome.effort ?? null,
      selectedStepIds: cleanStrings(doc.scriptAdjustmentOutcome.selectedStepIds),
      publishedStructureMatchScore: doc.scriptAdjustmentOutcome.publishedStructureMatchScore ?? null,
      capturedAt: asIso(doc.scriptAdjustmentOutcome.capturedAt),
    } : null,
  };
}

export async function getMcpVideoDiagnosis(params: {
  userId: string;
  diagnosisId?: string;
  instagramMediaId?: string;
}) {
  if (!Types.ObjectId.isValid(params.userId)) return null;
  await connectToDatabase();
  const query: AnyRecord = {
    userId: new Types.ObjectId(params.userId),
    status: "completed",
    historyVisibility: { $ne: "hidden" },
  };
  if (params.diagnosisId) query.diagnosisId = params.diagnosisId;
  if (params.instagramMediaId) query.linkedInstagramMediaId = params.instagramMediaId;
  const doc = await CreatorVideoNarrativeDiagnosis.findOne(query)
    .sort({ createdAt: -1 })
    .select("-videoMetadata.originalFileNameSanitized -videoMetadata.thumbnailUrl -contentPotentialFeedback -confirmationQuizAnswers")
    .lean<AnyRecord | null>();
  if (!doc) return null;
  const diagnosis = sanitizeMcpVideoDiagnosisDocument(doc);
  return diagnosis ?? {
    schemaVersion: "mcp_video_diagnosis_v1",
    intelligenceSchemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION,
    diagnosisId: doc.diagnosisId,
    unavailable: true,
    reason: "diagnosis_not_sanitized_for_external_ai",
  };
}

function demographics(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as AnyRecord;
  const normalizeBreakdown = (breakdown: unknown) => Array.isArray(breakdown)
    ? breakdown.slice(0, 25).flatMap((item: AnyRecord) => {
      const label = typeof item?.value === "string" ? item.value.trim() : "";
      const count = Number(item?.count);
      return label && Number.isFinite(count) && count >= 0 ? [{ label, count }] : [];
    })
    : [];
  return {
    city: normalizeBreakdown(record.city),
    country: normalizeBreakdown(record.country),
    age: normalizeBreakdown(record.age),
    gender: normalizeBreakdown(record.gender),
  };
}

export async function getMcpAudienceIntelligence(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return null;
  await connectToDatabase();
  const snapshots = await AccountInsightModel.find({ user: new Types.ObjectId(userId) })
    .sort({ recordedAt: -1 })
    .limit(2)
    .select("recordedAt followersCount followsCount mediaCount accountInsightsPeriod audienceDemographics accountDetails.username accountDetails.name")
    .lean<AnyRecord[]>();
  const latest = snapshots[0];
  if (!latest) return null;
  const previous = snapshots[1];
  const followerDelta = typeof latest.followersCount === "number" && typeof previous?.followersCount === "number"
    ? latest.followersCount - previous.followersCount
    : null;
  return {
    schemaVersion: "mcp_audience_intelligence_v1",
    intelligenceSchemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION,
    recordedAt: asIso(latest.recordedAt),
    account: {
      username: latest.accountDetails?.username ?? null,
      name: latest.accountDetails?.name ?? null,
      followers: latest.followersCount ?? null,
      following: latest.followsCount ?? null,
      mediaCount: latest.mediaCount ?? null,
    },
    periodInsights: latest.accountInsightsPeriod ?? null,
    followerDemographics: demographics(latest.audienceDemographics?.follower_demographics),
    engagedAudienceDemographics: demographics(latest.audienceDemographics?.engaged_audience_demographics),
    growth: {
      comparedTo: asIso(previous?.recordedAt),
      followerDelta,
      followerDeltaRate: followerDelta != null && typeof previous?.followersCount === "number" && previous.followersCount > 0
        ? followerDelta / previous.followersCount
        : null,
    },
    coverage: {
      periodInsights: Boolean(latest.accountInsightsPeriod),
      followerDemographics: Boolean(latest.audienceDemographics?.follower_demographics),
      engagedAudienceDemographics: Boolean(latest.audienceDemographics?.engaged_audience_demographics),
      historicalComparison: Boolean(previous),
    },
  };
}

export function sanitizeMcpWeeklyPayload(payload: AnyRecord | null | undefined) {
  if (!payload) return null;
  const weeklyVideo = payload.weeklyVideo ? { ...payload.weeklyVideo, thumbnailUrl: undefined } : null;
  const rawCoverage = payload.coverage && typeof payload.coverage === "object"
    ? payload.coverage as AnyRecord
    : {};
  const details = Array.isArray(payload.details) ? payload.details.map((detail: AnyRecord) => ({
    ...detail,
    groups: Array.isArray(detail.groups) ? detail.groups.map((group: AnyRecord) => ({
      ...group,
      items: Array.isArray(group.items) ? group.items.map((item: AnyRecord) => ({
        id: item.id,
        label: item.label,
        supportingPostsInBaseline: item.nPosts ?? 0,
        performanceIndex: item.index ?? null,
        evidence: item.evidence ?? null,
        occurrencesInClosedWeek: item.weeklyOccurrences ?? 0,
      })) : [],
    })) : [],
  })) : [];
  const overview = payload.overview && typeof payload.overview === "object"
    ? {
      ...payload.overview,
      numbers: Array.isArray(payload.overview.numbers)
        ? payload.overview.numbers.map((number: AnyRecord) => ({
          ...number,
          label: number.label === "posts" ? "publicações na semana fechada" : number.label,
        }))
        : [],
    }
    : null;
  return {
    period: payload.period ?? null,
    periodSemantics: {
      reportPeriod: "last_closed_week",
      baselinePeriod: "rolling_90_days_ending_with_closed_week",
      rule: "Contagens da semana fechada e suporte histórico de 90 dias são universos diferentes.",
    },
    generatedAt: payload.generatedAt ?? null,
    coverage: {
      publishedInClosedWeek: rawCoverage.postsWeek ?? 0,
      baselinePublishedCount: rawCoverage.posts90d ?? 0,
      sceneAnalyzedInBaseline: rawCoverage.postsWithScene ?? 0,
      sceneCoveragePercentInBaseline: rawCoverage.scenePercent ?? 0,
    },
    overview,
    weeklyVideo,
    details,
    responseContract: {
      rules: [
        "Use coverage.publishedInClosedWeek somente para a semana fechada identificada em period.",
        "supportingPostsInBaseline é suporte histórico de 90 dias, não quantidade publicada na semana.",
        "occurrencesInClosedWeek é ocorrência de um sinal, não total de publicações.",
        "Para responder uma contagem solicitada pelo usuário, use analyze_content_period.",
      ],
    },
  };
}

export async function getMcpCreatorPlaybook(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return null;
  await connectToDatabase();
  const objectId = new Types.ObjectId(userId);
  const [weekly, scriptOutcome] = await Promise.all([
    CreatorWeeklyReport.findOne({ userId: objectId, status: { $in: ["ready", "partial"] } })
      .sort({ periodEndsAt: -1 })
      .select("weekKey status generatedAt sourceMetricsUpdatedAt coverage payload")
      .lean<AnyRecord | null>(),
    ScriptOutcomeProfile.findOne({ userId: objectId })
      .select("profileVersion sampleSizeLinked lastComputedAt baseline topByDimension topExamples confidence")
      .lean<AnyRecord | null>(),
  ]);
  if (!weekly && !scriptOutcome) return null;
  return {
    schemaVersion: "mcp_creator_playbook_v1",
    intelligenceSchemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    weeklyPatterns: weekly ? {
      purpose: "historical_patterns_and_next_actions_not_requested_period_count",
      weekKey: weekly.weekKey,
      status: weekly.status,
      generatedAt: asIso(weekly.generatedAt),
      sourceMetricsUpdatedAt: asIso(weekly.sourceMetricsUpdatedAt),
      report: sanitizeMcpWeeklyPayload(weekly.payload),
    } : null,
    scriptOutcome: scriptOutcome ? {
      profileVersion: scriptOutcome.profileVersion,
      sampleSize: scriptOutcome.sampleSizeLinked ?? 0,
      confidence: scriptOutcome.confidence ?? "low",
      lastComputedAt: asIso(scriptOutcome.lastComputedAt),
      baseline: scriptOutcome.baseline ?? null,
      topByDimension: scriptOutcome.topByDimension ?? null,
      topExamples: Array.isArray(scriptOutcome.topExamples)
        ? scriptOutcome.topExamples.slice(0, 6).map((item: AnyRecord) => ({
          metricId: item.metricId,
          scriptId: item.scriptId,
          caption: typeof item.caption === "string" ? item.caption.slice(0, 400) : "",
          interactions: item.interactions ?? 0,
          engagement: item.engagement ?? null,
          lift: item.lift ?? null,
          postDate: asIso(item.postDate),
          categories: item.categories ?? {},
          hookSample: item.hookSample ?? null,
          ctaSample: item.ctaSample ?? null,
        }))
        : [],
    } : null,
    coverage: {
      weeklyReport: Boolean(weekly),
      scriptOutcome: Boolean(scriptOutcome),
    },
  };
}

export async function getMcpIntelligenceLayerCoverage(params: {
  userId: string;
  grantedScopes: string[];
}) {
  if (!Types.ObjectId.isValid(params.userId)) return [];
  await connectToDatabase();
  const objectId = new Types.ObjectId(params.userId);
  const allowed = (scope: string) => params.grantedScopes.includes(scope);
  const restricted = (id: string, scope: string) => ({
    id,
    status: "restricted" as const,
    requiredScope: scope,
    availableRecords: null,
    newestAt: null,
  });

  const intelligence = allowed("intelligence:read")
    ? await Promise.all([
      MapaSeed.findOne({ userId: objectId }).select("updatedAt").lean<AnyRecord | null>(),
      CreatorMapConfirmations.findOne({ userId: objectId }).select("updatedAt").lean<AnyRecord | null>(),
      CreatorVideoNarrativeDiagnosis.countDocuments({
        userId: objectId,
        status: "completed",
        historyVisibility: { $ne: "hidden" },
      }),
      CreatorVideoNarrativeDiagnosis.findOne({
        userId: objectId,
        status: "completed",
        historyVisibility: { $ne: "hidden" },
      }).sort({ createdAt: -1 }).select("createdAt").lean<AnyRecord | null>(),
      CreatorWeeklyReport.findOne({ userId: objectId, status: { $in: ["ready", "partial"] } })
        .sort({ periodEndsAt: -1 }).select("generatedAt").lean<AnyRecord | null>(),
      ScriptOutcomeProfile.findOne({ userId: objectId }).select("lastComputedAt sampleSizeLinked").lean<AnyRecord | null>(),
    ])
    : null;
  const audience = allowed("audience:read")
    ? await AccountInsightModel.findOne({ user: objectId }).sort({ recordedAt: -1 })
      .select("recordedAt audienceDemographics accountInsightsPeriod").lean<AnyRecord | null>()
    : null;
  const collabUser = allowed("collabs:read")
    ? await UserModel.findById(objectId).select("collabDiscoveryOptIn collabDiscoveryOptInDate").lean<AnyRecord | null>()
    : null;

  const layers: AnyRecord[] = [];
  if (!intelligence) {
    layers.push(restricted("creator_map", "intelligence:read"));
    layers.push(restricted("video_diagnosis", "intelligence:read"));
    layers.push(restricted("outcome_learning", "intelligence:read"));
  } else {
    const [map, confirmations, diagnosisCount, newestDiagnosis, weekly, outcome] = intelligence;
    layers.push({
      id: "creator_map",
      status: map || confirmations ? (map && confirmations ? "available" : "partial") : "unavailable",
      availableRecords: Number(Boolean(map)) + Number(Boolean(confirmations)),
      newestAt: [asIso(map?.updatedAt), asIso(confirmations?.updatedAt)].filter(Boolean).sort().at(-1) ?? null,
    });
    layers.push({
      id: "video_diagnosis",
      status: diagnosisCount > 0 ? "available" : "unavailable",
      availableRecords: diagnosisCount,
      newestAt: asIso(newestDiagnosis?.createdAt),
    });
    layers.push({
      id: "outcome_learning",
      status: weekly || outcome ? (weekly && outcome ? "available" : "partial") : "unavailable",
      availableRecords: Number(Boolean(weekly)) + Number(Boolean(outcome)),
      newestAt: [asIso(weekly?.generatedAt), asIso(outcome?.lastComputedAt)].filter(Boolean).sort().at(-1) ?? null,
      scriptSamples: outcome?.sampleSizeLinked ?? 0,
    });
  }
  layers.push(allowed("audience:read") ? {
    id: "audience",
    status: audience ? "available" : "unavailable",
    availableRecords: audience ? 1 : 0,
    newestAt: asIso(audience?.recordedAt),
    demographics: Boolean(audience?.audienceDemographics),
    periodInsights: Boolean(audience?.accountInsightsPeriod),
  } : restricted("audience", "audience:read"));
  layers.push(allowed("collabs:read") ? {
    id: "collaboration_network",
    status: collabUser?.collabDiscoveryOptIn ? "available" : "partial",
    availableRecords: null,
    newestAt: asIso(collabUser?.collabDiscoveryOptInDate),
    creatorDiscoverable: Boolean(collabUser?.collabDiscoveryOptIn),
  } : restricted("collaboration_network", "collabs:read"));
  return layers;
}
